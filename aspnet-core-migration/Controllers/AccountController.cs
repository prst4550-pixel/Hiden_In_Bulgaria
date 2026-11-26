using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using HiddenBulgaria.Data;
using HiddenBulgaria.Models;
using System.Security.Cryptography;
using System.Text;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;

namespace HiddenBulgaria.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AccountController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public AccountController(ApplicationDbContext context)
        {
            _context = context;
        }

        public record LoginDto(string Email, string Password);
        public record RegisterDto(string Name, string Email, string Password);

        private static string HashPassword(string password, string salt)
        {
            using var pbkdf2 = new Rfc2898DeriveBytes(password, Encoding.UTF8.GetBytes(salt), 1000, HashAlgorithmName.SHA512);
            return Convert.ToHexString(pbkdf2.GetBytes(64)).ToLower();
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Email) || string.IsNullOrWhiteSpace(dto.Password))
                return BadRequest(new { error = "Моля, въведете имейл и парола." });

            var email = dto.Email.Trim().ToLower();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email);
            if (user == null)
                return Unauthorized(new { error = "Невалиден имейл или парола." });

            var hash = HashPassword(dto.Password, user.salt);
            if (hash != user.PasswordHash)
                return Unauthorized(new { error = "Невалиден имейл или парола." });

            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id),
                new Claim(ClaimTypes.Name, user.Name),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim(ClaimTypes.Role, user.Role)
            };

            var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
            await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(identity));

            return Ok(new
            {
                user = new
                {
                    user.Id,
                    user.Name,
                    user.Email,
                    user.Role,
                    user.CreatedAt
                }
            });
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Email) || string.IsNullOrWhiteSpace(dto.Password) || string.IsNullOrWhiteSpace(dto.Name))
                return BadRequest(new { error = "Моля, попълнете всички задължителни полета." });

            var email = dto.Email.Trim().ToLower();
            var exists = await _context.Users.AnyAsync(u => u.Email.ToLower() == email);
            if (exists)
                return Conflict(new { error = "Вече съществува профил с този имейл адрес." });

            var salt = Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLower();
            var newUser = new User
            {
                Name = dto.Name.Trim(),
                Email = email,
                Salt = salt,
                PasswordHash = HashPassword(dto.Password, salt),
                Role = "user"
            };

            _context.Users.Add(newUser);
            await _context.SaveChangesAsync();

            return Created("", new
            {
                user = new
                {
                    newUser.Id,
                    newUser.Name,
                    newUser.Email,
                    newUser.Role,
                    newUser.CreatedAt
                }
            });
        }

        [HttpGet("me")]
        public async Task<IActionResult> GetCurrentUser()
        {
            if (!User.Identity?.IsAuthenticated ?? true)
                return Unauthorized();

            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return Unauthorized();

            return Ok(new
            {
                user = new
                {
                    user.Id,
                    user.Name,
                    user.Email,
                    user.Role,
                    user.CreatedAt
                }
            });
        }

        [HttpPost("logout")]
        public async Task<IActionResult> Logout()
        {
            await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return Ok(new { message = "Успешен изход от профила." });
        }

        [Authorize(Roles = "admin")]
        [HttpGet("users")]
        public async Task<IActionResult> GetAllUsers()
        {
            var users = await _context.Users
                .Select(u => new
                {
                    u.Id,
                    u.Name,
                    u.Email,
                    u.Role,
                    u.CreatedAt
                })
                .ToListAsync();

            return Ok(users);
        }
    }
}
