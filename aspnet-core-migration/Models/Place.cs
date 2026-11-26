using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HiddenBulgaria.Models
{
    public class Place
    {
        [Key]
        public string Id { get; set; } = Guid.NewGuid().ToString();

        [Required(ErrorMessage = "Името на обекта е задължително")]
        [StringLength(150)]
        [Display(Name = "Име на обекта")]
        public string Name { get; set; } = string.Empty;

        public string Slug { get; set; } = string.Empty;

        [Required]
        public string RegionId { get; set; } = string.Empty;

        [Display(Name = "Регион")]
        public string RegionName { get; set; } = string.Empty;

        [Required]
        public string CategoryId { get; set; } = string.Empty;

        [Display(Name = "Категория")]
        public string CategoryName { get; set; } = string.Empty;

        [Required]
        [Range(41.0, 44.5, ErrorMessage = "Координатите трябва да попадат в България")]
        public double Latitude { get; set; }

        [Required]
        [Range(22.0, 29.0, ErrorMessage = "Координатите трябва да попадат в България")]
        public double Longitude { get; set; }

        public int? Altitude { get; set; }

        [Required]
        [StringLength(300)]
        [Display(Name = "Кратко описание")]
        public string ShortDescription { get; set; } = string.Empty;

        [Required]
        [Display(Name = "Пълно описание")]
        public string FullDescription { get; set; } = string.Empty;

        [Display(Name = "История и културно наследство")]
        public string History { get; set; } = string.Empty;

        [Display(Name = "Съвети за достъп и терен")]
        public string AccessTips { get; set; } = string.Empty;

        [Display(Name = "Тип терен")]
        public string TerrainType { get; set; } = "Планински";

        [Display(Name = "Трудност")]
        public string Difficulty { get; set; } = "Умерен";

        [Display(Name = "Подходящ сезон")]
        public string BestSeason { get; set; } = "Пролет - Есен";

        public string ImageUrl { get; set; } = string.Empty;

        public string ImageCredit { get; set; } = string.Empty;

        public bool IsFeatured { get; set; } = false;

        public bool IsVerified { get; set; } = true;

        public double Rating { get; set; } = 5.0;

        public int ReviewCount { get; set; } = 0;
    }
}
