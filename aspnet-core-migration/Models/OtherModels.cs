namespace HiddenBulgaria.Models
{
    public class Category
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string IconName { get; set; } = string.Empty;
    }

    public class Region
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public double CenterLat { get; set; }
        public double CenterLng { get; set; }
        public int ZoomLevel { get; set; } = 9;
    }

    public class Route
    {
        public string Id { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Duration { get; set; } = string.Empty;
        public string TotalDistance { get; set; } = string.Empty;
        public string Difficulty { get; set; } = "Умерен";
        public string RegionName { get; set; } = string.Empty;
        public string ImageUrl { get; set; } = string.Empty;
    }

    public class RouteStop
    {
        public int Id { get; set; }
        public string RouteId { get; set; } = string.Empty;
        public string PlaceId { get; set; } = string.Empty;
        public string PlaceName { get; set; } = string.Empty;
        public int Order { get; set; }
        public string Notes { get; set; } = string.Empty;
        public double Latitude { get; set; }
        public double Longitude { get; set; }
    }

    public class CommunitySuggestion
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string Name { get; set; } = string.Empty;
        public string Region { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public double Latitude { get; set; }
        public double Longitude { get; set; }
        public string Description { get; set; } = string.Empty;
        public string Source { get; set; } = string.Empty;
        public string? ImageUrl { get; set; }
        public string? Contact { get; set; }
        public string Status { get; set; } = "pending";
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public class Review
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string PlaceId { get; set; } = string.Empty;
        public string Author { get; set; } = string.Empty;
        public int Rating { get; set; } = 5;
        public string Comment { get; set; } = string.Empty;
        public string VisitSeason { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public class User
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string Name { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string PasswordHash { get; set; } = string.Empty;
        public string Salt { get; set; } = string.Empty;
        public string Role { get; set; } = "user"; // "admin" or "user"
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}

