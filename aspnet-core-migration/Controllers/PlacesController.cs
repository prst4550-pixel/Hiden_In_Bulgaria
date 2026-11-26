using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using HiddenBulgaria.Data;
using HiddenBulgaria.Models;
using Microsoft.AspNetCore.Authorization;

namespace HiddenBulgaria.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class PlacesController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public PlacesController(ApplicationDbContext context)
        {
            _context = context;
        }

        // GET: api/places
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Place>>> GetPlaces(
            [FromQuery] string? category,
            [FromQuery] string? region,
            [FromQuery] string? search)
        {
            var query = _context.Places.AsQueryable();

            if (!string.IsNullOrEmpty(category) && category != "all")
            {
                query = query.Where(p => p.CategoryId == category);
            }

            if (!string.IsNullOrEmpty(region) && region != "all")
            {
                query = query.Where(p => p.RegionId == region);
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim().ToLower();
                query = query.Where(p => p.Name.ToLower().Contains(term) ||
                                         p.ShortDescription.ToLower().Contains(term) ||
                                         p.RegionName.ToLower().Contains(term));
            }

            return await query.ToListAsync();
        }

        // GET: api/places/{id}
        [HttpGet("{id}")]
        public async Task<ActionResult<Place>> GetPlace(string id)
        {
            var place = await _context.Places.FirstOrDefaultAsync(p => p.Id == id || p.Slug == id);
            if (place == null) return NotFound(new { error = "Обектът не е намерен." });
            return place;
        }

        // POST: api/places (Admin only)
        [HttpPost]
        [Authorize(Roles = "admin")]
        public async Task<ActionResult<Place>> CreatePlace([FromBody] Place place)
        {
            if (string.IsNullOrWhiteSpace(place.Name))
                return BadRequest(new { error = "Името на обекта е задължително." });

            if (string.IsNullOrEmpty(place.Id))
                place.Id = "place-" + DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

            if (string.IsNullOrEmpty(place.Slug))
                place.Slug = place.Name.Trim().ToLower().Replace(" ", "-");

            _context.Places.Add(place);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetPlace), new { id = place.Id }, place);
        }

        // PUT: api/places/{id} (Admin only)
        [HttpPut("{id}")]
        [Authorize(Roles = "admin")]
        public async Task<IActionResult> UpdatePlace(string id, [FromBody] Place updated)
        {
            var existing = await _context.Places.FirstOrDefaultAsync(p => p.Id == id || p.Slug == id);
            if (existing == null) return NotFound(new { error = "Обектът не е намерен." });

            existing.Name = updated.Name;
            existing.CategoryId = updated.CategoryId;
            existing.CategoryName = updated.CategoryName;
            existing.RegionId = updated.RegionId;
            existing.RegionName = updated.RegionName;
            existing.Latitude = updated.Latitude;
            existing.Longitude = updated.Longitude;
            existing.Altitude = updated.Altitude;
            existing.ShortDescription = updated.ShortDescription;
            existing.FullDescription = updated.FullDescription;
            existing.History = updated.History;
            existing.AccessTips = updated.AccessTips;
            existing.TerrainType = updated.TerrainType;
            existing.Difficulty = updated.Difficulty;
            existing.BestSeason = updated.BestSeason;
            existing.ImageUrl = updated.ImageUrl;
            existing.ImageCredit = updated.ImageCredit;
            existing.IsFeatured = updated.IsFeatured;

            await _context.SaveChangesAsync();
            return Ok(existing);
        }

        // DELETE: api/places/{id} (Admin only)
        [HttpDelete("{id}")]
        [Authorize(Roles = "admin")]
        public async Task<IActionResult> DeletePlace(string id)
        {
            var place = await _context.Places.FirstOrDefaultAsync(p => p.Id == id || p.Slug == id);
            if (place == null) return NotFound(new { error = "Обектът не е намерен." });

            _context.Places.Remove(place);
            await _context.SaveChangesAsync();

            return Ok(new { message = $"Обектът \"{place.Name}\" беше изтрит успешно." });
        }
    }
}
