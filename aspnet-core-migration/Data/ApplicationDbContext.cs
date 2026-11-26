using Microsoft.EntityFrameworkCore;
using HiddenBulgaria.Models;

namespace HiddenBulgaria.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        public DbSet<Place> Places { get; set; } = null!;
        public DbSet<Category> Categories { get; set; } = null!;
        public DbSet<Region> Regions { get; set; } = null!;
        public DbSet<Route> Routes { get; set; } = null!;
        public DbSet<RouteStop> RouteStops { get; set; } = null!;
        public DbSet<CommunitySuggestion> CommunitySuggestions { get; set; } = null!;
        public DbSet<Review> Reviews { get; set; } = null!;
        public DbSet<User> Users { get; set; } = null!;

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<Place>()
                .HasIndex(p => p.CategoryId);

            modelBuilder.Entity<Place>()
                .HasIndex(p => p.RegionId);

            modelBuilder.Entity<RouteStop>()
                .HasIndex(rs => rs.RouteId);

            modelBuilder.Entity<User>()
                .HasIndex(u => u.Email)
                .IsUnique();

            // Seed Admin user (email: prst4550@gmail.com, password: Admin1234.)
            modelBuilder.Entity<User>().HasData(new User
            {
                Id = "usr-admin-1",
                Name = "Admin",
                Email = "prst4550@gmail.com",
                Role = "admin",
                Salt = "e0e37d116f0ce6056da85cb8f38cdb24",
                PasswordHash = "4b4f59664539da12ff953f47e3a99268686e017e4fbc8adbeffba68da33fdf39688ae5746b41295b28d706eebf09230571d53018e69d7ca7209f8ae8fca02d13",
                CreatedAt = new DateTime(2026, 10, 16, 0, 0, 0, DateTimeKind.Utc)
            });
        }
    }
}
