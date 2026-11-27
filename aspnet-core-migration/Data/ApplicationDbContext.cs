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
        public DbSet<HiddenBulgaria.Models.Route> Routes { get; set; } = null!;
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

            // The admin account is NOT seeded here with fixed credentials (that would ship a
            // publicly known admin password). It is created at startup in Program.cs from the
            // ADMIN_EMAIL / ADMIN_PASSCODE configuration values.
        }
    }
}
