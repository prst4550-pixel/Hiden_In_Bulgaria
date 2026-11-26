import fs from 'fs';
import path from 'path';

const dbPath = path.resolve('./data/database.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

function sqlStr(str) {
  if (str === null || str === undefined) return 'NULL';
  return "N'" + String(str).replace(/'/g, "''") + "'";
}

let sql = `-- =========================================================================
-- BULGARIA TRAVEL & HISTORICAL SANCTUARIES (Скритите съкровища на България)
-- RELATIONAL DATABASE DEFINITION & SEED SCRIPT FOR MICROSOFT SQL SERVER / SSMS
-- Compatible with:
--   * Microsoft SQL Server Management Studio (SSMS 18, 19, 20)
--   * Microsoft SQL Server 2017, 2019, 2022
--   * Azure SQL Database & Azure SQL Managed Instance
-- Features:
--   * Full Unicode Cyrillic Support (NVARCHAR, Cyrillic_General_100_CI_AI_SC_UTF8)
--   * Native Spatial GEOGRAPHY Data Types (WGS84 / SRID 4326)
--   * Spatial Indexes (GEOGRAPHY_GRID)
--   * Relational Integrity & Foreign Keys with Cascading Rules
--   * Analytic Views, Stored Procedures & Geofencing Queries
-- =========================================================================

SET NOCOUNT ON;
GO

-- 1. DATABASE CREATION
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'BulgariaTravel')
BEGIN
    PRINT N'[SSMS] Създаване на база данни BulgariaTravel...';
    CREATE DATABASE [BulgariaTravel]
    COLLATE Cyrillic_General_100_CI_AI_SC_UTF8;
END
GO

USE [BulgariaTravel];
GO

-- 2. CLEANUP PREVIOUS OBJECTS IF THEY EXIST
IF OBJECT_ID(N'dbo.usp_FindNearbyPlaces', N'P') IS NOT NULL DROP PROCEDURE dbo.usp_FindNearbyPlaces;
IF OBJECT_ID(N'dbo.usp_SearchCatalog', N'P') IS NOT NULL DROP PROCEDURE dbo.usp_SearchCatalog;
IF OBJECT_ID(N'dbo.vw_FeaturedDestinations', N'V') IS NOT NULL DROP VIEW dbo.vw_FeaturedDestinations;
IF OBJECT_ID(N'dbo.vw_RegionalStatistics', N'V') IS NOT NULL DROP VIEW dbo.vw_RegionalStatistics;
IF OBJECT_ID(N'dbo.vw_PlacesDetailed', N'V') IS NOT NULL DROP VIEW dbo.vw_PlacesDetailed;

IF OBJECT_ID(N'dbo.RouteStops', N'U') IS NOT NULL DROP TABLE dbo.RouteStops;
IF OBJECT_ID(N'dbo.Routes', N'U') IS NOT NULL DROP TABLE dbo.Routes;
IF OBJECT_ID(N'dbo.Reviews', N'U') IS NOT NULL DROP TABLE dbo.Reviews;
IF OBJECT_ID(N'dbo.Places', N'U') IS NOT NULL DROP TABLE dbo.Places;
IF OBJECT_ID(N'dbo.Categories', N'U') IS NOT NULL DROP TABLE dbo.Categories;
IF OBJECT_ID(N'dbo.Regions', N'U') IS NOT NULL DROP TABLE dbo.Regions;
IF OBJECT_ID(N'dbo.CommunitySuggestions', N'U') IS NOT NULL DROP TABLE dbo.CommunitySuggestions;
IF OBJECT_ID(N'dbo.Users', N'U') IS NOT NULL DROP TABLE dbo.Users;
GO

PRINT N'[SSMS] Създаване на релационни таблици...';
GO

-- 3. TABLES DEFINITION

CREATE TABLE [dbo].[Categories] (
    [CategoryId]    NVARCHAR(50)  NOT NULL,
    [Name]          NVARCHAR(100) NOT NULL,
    [Slug]          NVARCHAR(100) NOT NULL,
    [Description]   NVARCHAR(500) NULL,
    [Icon]          NVARCHAR(50)  NULL,
    [CreatedAt]     DATETIME2(3)  NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_Categories] PRIMARY KEY CLUSTERED ([CategoryId] ASC)
);
GO

CREATE TABLE [dbo].[Regions] (
    [RegionId]      NVARCHAR(50)  NOT NULL,
    [Name]          NVARCHAR(100) NOT NULL,
    [Description]   NVARCHAR(500) NULL,
    [BoundNorth]    FLOAT         NULL,
    [BoundSouth]    FLOAT         NULL,
    [BoundEast]     FLOAT         NULL,
    [BoundWest]     FLOAT         NULL,
    [CreatedAt]     DATETIME2(3)  NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_Regions] PRIMARY KEY CLUSTERED ([RegionId] ASC)
);
GO

CREATE TABLE [dbo].[Places] (
    [PlaceId]           NVARCHAR(50)   NOT NULL,
    [Name]              NVARCHAR(200)  NOT NULL,
    [Slug]              NVARCHAR(200)  NOT NULL,
    [CategoryId]        NVARCHAR(50)   NOT NULL,
    [RegionId]          NVARCHAR(50)   NOT NULL,
    [Latitude]          FLOAT          NOT NULL,
    [Longitude]         FLOAT          NOT NULL,
    [GeoLocation]       GEOGRAPHY      NULL,
    [ElevationMeters]   INT            NOT NULL DEFAULT 0,
    [Difficulty]        NVARCHAR(50)   NOT NULL DEFAULT N'Лесен',
    [AccessDetails]     NVARCHAR(500)  NULL,
    [BestSeason]        NVARCHAR(100)  NULL,
    [ShortDescription]  NVARCHAR(1000) NOT NULL,
    [FullDescription]   NVARCHAR(MAX)  NOT NULL,
    [HistoricalContext] NVARCHAR(MAX)  NULL,
    [ImageUrl]          NVARCHAR(500)  NOT NULL,
    [ImageCredit]       NVARCHAR(200)  NULL,
    [IsFeatured]        BIT            NOT NULL DEFAULT 0,
    [CreatedAt]         DATETIME2(3)   NOT NULL DEFAULT SYSUTCDATETIME(),
    [UpdatedAt]         DATETIME2(3)   NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_Places] PRIMARY KEY CLUSTERED ([PlaceId] ASC),
    CONSTRAINT [FK_Places_Categories] FOREIGN KEY ([CategoryId]) REFERENCES [dbo].[Categories] ([CategoryId]) ON DELETE NO ACTION,
    CONSTRAINT [FK_Places_Regions] FOREIGN KEY ([RegionId]) REFERENCES [dbo].[Regions] ([RegionId]) ON DELETE NO ACTION
);
GO

CREATE TABLE [dbo].[Routes] (
    [RouteId]       NVARCHAR(50)  NOT NULL,
    [Title]         NVARCHAR(200) NOT NULL,
    [Slug]          NVARCHAR(200) NOT NULL,
    [RegionId]      NVARCHAR(50)  NOT NULL,
    [Difficulty]    NVARCHAR(50)  NOT NULL,
    [DurationHours] FLOAT         NOT NULL,
    [DistanceKm]    FLOAT         NOT NULL,
    [Description]   NVARCHAR(MAX) NOT NULL,
    [CreatedAt]     DATETIME2(3)  NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_Routes] PRIMARY KEY CLUSTERED ([RouteId] ASC),
    CONSTRAINT [FK_Routes_Regions] FOREIGN KEY ([RegionId]) REFERENCES [dbo].[Regions] ([RegionId]) ON DELETE CASCADE
);
GO

CREATE TABLE [dbo].[RouteStops] (
    [StopId]        INT IDENTITY(1,1) NOT NULL,
    [RouteId]       NVARCHAR(50)  NOT NULL,
    [PlaceId]       NVARCHAR(50)  NOT NULL,
    [StopOrder]     INT           NOT NULL,
    [Notes]         NVARCHAR(500) NULL,
    CONSTRAINT [PK_RouteStops] PRIMARY KEY CLUSTERED ([StopId] ASC),
    CONSTRAINT [FK_RouteStops_Routes] FOREIGN KEY ([RouteId]) REFERENCES [dbo].[Routes] ([RouteId]) ON DELETE CASCADE,
    CONSTRAINT [FK_RouteStops_Places] FOREIGN KEY ([PlaceId]) REFERENCES [dbo].[Places] ([PlaceId]) ON DELETE CASCADE
);
GO

CREATE TABLE [dbo].[Users] (
    [UserId]        NVARCHAR(50)  NOT NULL,
    [Email]         NVARCHAR(200) NOT NULL,
    [PasswordHash]  NVARCHAR(256) NOT NULL,
    [Salt]          NVARCHAR(64)  NOT NULL,
    [FullName]      NVARCHAR(100) NOT NULL,
    [Role]          NVARCHAR(20)  NOT NULL DEFAULT N'user',
    [CreatedAt]     DATETIME2(3)  NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_Users] PRIMARY KEY CLUSTERED ([UserId] ASC),
    CONSTRAINT [UQ_Users_Email] UNIQUE NONCLUSTERED ([Email] ASC)
);
GO

CREATE TABLE [dbo].[CommunitySuggestions] (
    [SuggestionId]  NVARCHAR(50)  NOT NULL,
    [Name]          NVARCHAR(200) NOT NULL,
    [Region]        NVARCHAR(100) NOT NULL,
    [Category]      NVARCHAR(100) NOT NULL,
    [Latitude]      FLOAT         NOT NULL,
    [Longitude]     FLOAT         NOT NULL,
    [Description]   NVARCHAR(MAX) NOT NULL,
    [Source]        NVARCHAR(200) NULL,
    [Contact]       NVARCHAR(200) NULL,
    [Status]        NVARCHAR(20)  NOT NULL DEFAULT N'pending',
    [CreatedAt]     DATETIME2(3)  NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_CommunitySuggestions] PRIMARY KEY CLUSTERED ([SuggestionId] ASC)
);
GO

CREATE TABLE [dbo].[Reviews] (
    [ReviewId]      NVARCHAR(50)  NOT NULL,
    [PlaceId]       NVARCHAR(50)  NOT NULL,
    [Author]        NVARCHAR(100) NOT NULL,
    [Rating]        INT           NOT NULL CHECK (Rating BETWEEN 1 AND 5),
    [Comment]       NVARCHAR(MAX) NOT NULL,
    [VisitSeason]   NVARCHAR(50)  NULL,
    [CreatedAt]     DATETIME2(3)  NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_Reviews] PRIMARY KEY CLUSTERED ([ReviewId] ASC),
    CONSTRAINT [FK_Reviews_Places] FOREIGN KEY ([PlaceId]) REFERENCES [dbo].[Places] ([PlaceId]) ON DELETE CASCADE
);
GO

-- 4. INSERT MASTER DATA: CATEGORIES
PRINT N'[SSMS] Записване на категории...';
INSERT INTO [dbo].[Categories] ([CategoryId], [Name], [Slug], [Description], [Icon])
VALUES
(N'sanctuaries', N'Древни светилища', N'sanctuaries', N'Мегалити, тракийски култови комплекси и скални олтари', N'Sun'),
(N'fortresses', N'Непристъпни крепости', N'fortresses', N'Антични кастели, средновековни цитадели и скални стражи', N'Shield'),
(N'canyons', N'Водопади и каньони', N'canyons', N'Дълбоки ждрела, карстови извори и водни каскади', N'Waves'),
(N'caves', N'Пещери и пропасти', N'caves', N'Неосветени карстови зали, пропасти и скални ниши', N'Mountain'),
(N'villages', N'Автентични селища', N'villages', N'Каменни възрожденски махали и съхранени традиции', N'Home'),
(N'nature-phenomena', N'Природни феномени', N'nature-phenomena', N'Земни пирамиди, вкаменени сватби и скални мостове', N'Compass');
GO

-- 5. INSERT MASTER DATA: REGIONS
PRINT N'[SSMS] Записване на региони...';
INSERT INTO [dbo].[Regions] ([RegionId], [Name], [Description], [BoundNorth], [BoundSouth], [BoundEast], [BoundWest])
VALUES
(N'rhodopes', N'Южен централен (Родопи и Тракия)', N'Орфеевата планина, светилища на бесите и меандрите на Арда', 42.4, 41.2, 26.2, 23.8),
(N'danube-balkan', N'Северен централен (Дунав и Балкан)', N'Каньонът на Русенски Лом, старопланински проходи и римски кастели', 43.9, 42.6, 26.3, 24.8),
(N'northwest', N'Северозападен регион', N'Белоградчишките скали, Врачански карст, пещери и дунавски твърдини', 44.1, 43.1, 24.3, 22.3),
(N'blacksea-dobrudzha', N'Североизточен (Черноморие и Добруджа)', N'Каньонът на Суха река, скалните брегове на Тюленово и Яйлата', 43.8, 43.1, 28.6, 27.2),
(N'southwest', N'Югозападен (Пирин, Рила и Огражден)', N'Стобските пирамиди, Беласица, Огражден и каньонът на Струма', 42.2, 41.3, 23.9, 22.8),
(N'southeast-strandzha', N'Югоизточен (Странджа и Сакар)', N'Мистичните гори на Странджа, долмени, лековити аязми и Сакарски мегалити', 42.5, 41.9, 28.0, 26.0);
GO

-- 6. INSERT PLACES (ALL 48 LOCATIONS WITH GEOGRAPHICAL DATA)
PRINT N'[SSMS] Записване на 48 исторически и географски обекта...';
`;

// Insert places in batches
db.places.forEach((p, idx) => {
  sql += `INSERT INTO [dbo].[Places] ([PlaceId], [Name], [Slug], [CategoryId], [RegionId], [Latitude], [Longitude], [ElevationMeters], [Difficulty], [AccessDetails], [BestSeason], [ShortDescription], [FullDescription], [HistoricalContext], [ImageUrl], [ImageCredit], [IsFeatured])
VALUES (
    ${sqlStr(p.id)},
    ${sqlStr(p.name)},
    ${sqlStr(p.slug)},
    ${sqlStr(p.categoryId)},
    ${sqlStr(p.regionId)},
    ${p.latitude},
    ${p.longitude},
    ${p.elevationMeters || 0},
    ${sqlStr(p.difficulty || 'Умерен')},
    ${sqlStr(p.accessDetails)},
    ${sqlStr(p.bestSeason)},
    ${sqlStr(p.shortDescription)},
    ${sqlStr(p.fullDescription)},
    ${sqlStr(p.historicalContext)},
    ${sqlStr(p.imageUrl)},
    ${sqlStr(p.imageCredit || 'Архив Скрито в България')},
    ${p.isFeatured ? 1 : 0}
);
`;
  if ((idx + 1) % 10 === 0) {
    sql += `GO\n`;
  }
});

sql += `GO

-- 7. GENERATE GEOGRAPHY SPATIAL DATA (SRID 4326 / WGS84)
PRINT N'[SSMS] Изчисляване на пространствени GEOGRAPHY точки...';
UPDATE [dbo].[Places]
SET [GeoLocation] = geography::Point(Latitude, Longitude, 4326)
WHERE Latitude IS NOT NULL AND Longitude IS NOT NULL;
GO

-- 8. CREATE SPATIAL INDEXES AND PERFORMANCE INDEXES
PRINT N'[SSMS] Създаване на пространствени и филтриращи индекси...';
CREATE SPATIAL INDEX [SIX_Places_GeoLocation]
ON [dbo].[Places]([GeoLocation])
USING GEOGRAPHY_GRID
WITH (
    GRIDS = (LEVEL_1 = MEDIUM, LEVEL_2 = MEDIUM, LEVEL_3 = MEDIUM, LEVEL_4 = MEDIUM),
    CELLS_PER_OBJECT = 16
);
GO

CREATE NONCLUSTERED INDEX [IX_Places_CategoryId] ON [dbo].[Places]([CategoryId]) INCLUDE ([Name], [RegionId], [IsFeatured]);
CREATE NONCLUSTERED INDEX [IX_Places_RegionId] ON [dbo].[Places]([RegionId]) INCLUDE ([Name], [CategoryId], [IsFeatured]);
CREATE NONCLUSTERED INDEX [IX_Places_IsFeatured] ON [dbo].[Places]([IsFeatured]) WHERE [IsFeatured] = 1;
GO

-- 9. INSERT USERS (ADMIN & AUDITOR)
PRINT N'[SSMS] Записване на потребители...';
INSERT INTO [dbo].[Users] ([UserId], [Email], [PasswordHash], [Salt], [FullName], [Role])
VALUES
(N'usr-admin-1', N'prst4550@gmail.com', N'Admin1234.Hashed', N'salt123', N'Главен Администратор', N'admin'),
(N'usr-curator-2', N'curator@bulgariatravel.bg', N'Curator1234.Hashed', N'salt456', N'Теренен Изследовател', N'user');
GO

-- 10. INSERT ROUTES & STOPS
PRINT N'[SSMS] Записване на експедиционни маршрути...';
INSERT INTO [dbo].[Routes] ([RouteId], [Title], [Slug], [RegionId], [Difficulty], [DurationHours], [DistanceKm], [Description])
VALUES
(N'rhodope-sanctuaries', N'Свещеният триъгълник на Родопите: Белинташ — Караджов камък — Кръстова гора', N'rhodope-sanctuaries', N'rhodopes', N'Труден', 8.5, 22.0, N'Енергиен маршрут през най-мистичните тракийски скални олтари в централната част на Родопите.'),
(N'arda-meanders-castles', N'По меандрите на Арда: Дяволски мост — Чока градище — Перперикон', N'arda-meanders-castles', N'rhodopes', N'Умерен', 12.0, 68.0, N'Панорамен преход покрай тюркоазените извивки на река Арда и древните скални цитадели.'),
(N'danube-canyons', N'Скални обители на Русенски Лом и кастел Ятрус', N'danube-canyons', N'danube-balkan', N'Лесен', 6.0, 35.0, N'Пътешествие покрай речните каньони на Дунавската равнина и средновековните скални стенописи.'),
(N'vratsa-karst', N'Тайните на Врачанския карст: Проходна — Божия мост — Врачанска Скакля', N'vratsa-karst', N'northwest', N'Умерен', 7.5, 45.0, N'От гигантските пещерни сводове на „Очите на Бога“ до най-високия непостоянен водопад на Балканите.'),
(N'strandzha-misteries', N'Мистичната Странджа: Меандрите на Велека — Индипасха — Мишкова нива', N'strandzha-misteries', N'southeast-strandzha', N'Умерен', 9.0, 32.0, N'Древни лековити оброчища сред вековни дъбови гори и дивото устие на Велека.');
GO

-- 11. INSERT COMMUNITY SUGGESTIONS & REVIEWS
PRINT N'[SSMS] Записване на теренни отзиви и предложения...';
INSERT INTO [dbo].[CommunitySuggestions] ([SuggestionId], [Name], [Region], [Category], [Latitude], [Longitude], [Description], [Source], [Contact], [Status])
VALUES
(N'sugg-1', N'Скално светилище Купена край село Песнопой', N'Южен централен (Родопи и Тракия)', N'Древни светилища', 42.4561, 24.8123, N'Масивен скален връх с изсечени ритуални ями и невероятна панорама към долината на река Стряма.', N'Краеведски архив Пловдив', N'boris.georgiev@example.bg', N'approved'),
(N'sugg-2', N'Каньонът на река Черни Лом при село Кошов', N'Северен централен (Дунав и Балкан)', N'Водопади и каньони', 43.6621, 25.9812, N'Див меандър на Лома с отвесни бели варовикови стени и скрити пещери.', N'Природен парк Русенски Лом', N'elena.dimitrova@example.bg', N'pending');
GO

INSERT INTO [dbo].[Reviews] ([ReviewId], [PlaceId], [Author], [Rating], [Comment], [VisitSeason])
VALUES
(N'rev-1', N'belintash', N'Красимир Стойчев', 5, N'Уникална енергия при изгрев слънце! Пътят от село Врата е добър, но носете подходящи планински обувки.', N'Септември 2025'),
(N'rev-2', N'dyavolski-most', N'Ралица Костова', 5, N'Абсолютно задължително място. Отражението в Арда следобед прави пълна окръжност.', N'Май 2025'),
(N'rev-3', N'belogradchishki-skali', N'Димитър Ангелов', 5, N'Величието на скалите е неописуемо. Най-красиво е при залез, когато камъкът става рубинено червен.', N'Октомври 2025');
GO

-- 12. ADVANCED RELATIONAL VIEWS (SSMS OBJECT EXPLORER VIEWS)
PRINT N'[SSMS] Създаване на изгледи (Views)...';
GO

CREATE VIEW [dbo].[vw_PlacesDetailed]
AS
SELECT 
    p.PlaceId,
    p.Name AS PlaceName,
    p.Slug,
    c.Name AS CategoryName,
    r.Name AS RegionName,
    p.Latitude,
    p.Longitude,
    p.ElevationMeters,
    p.Difficulty,
    p.BestSeason,
    p.ShortDescription,
    p.ImageUrl,
    p.IsFeatured,
    (SELECT COUNT(*) FROM dbo.Reviews rev WHERE rev.PlaceId = p.PlaceId) AS ReviewCount,
    (SELECT AVG(CAST(rev.Rating AS FLOAT)) FROM dbo.Reviews rev WHERE rev.PlaceId = p.PlaceId) AS AverageRating
FROM [dbo].[Places] p
INNER JOIN [dbo].[Categories] c ON p.CategoryId = c.CategoryId
INNER JOIN [dbo].[Regions] r ON p.RegionId = r.RegionId;
GO

CREATE VIEW [dbo].[vw_FeaturedDestinations]
AS
SELECT 
    PlaceId,
    PlaceName,
    CategoryName,
    RegionName,
    ElevationMeters,
    Difficulty,
    ImageUrl
FROM [dbo].[vw_PlacesDetailed]
WHERE IsFeatured = 1;
GO

CREATE VIEW [dbo].[vw_RegionalStatistics]
AS
SELECT 
    r.RegionId,
    r.Name AS RegionName,
    COUNT(p.PlaceId) AS TotalPlaces,
    MIN(p.ElevationMeters) AS MinElevation,
    MAX(p.ElevationMeters) AS MaxElevation,
    AVG(p.ElevationMeters) AS AvgElevation,
    SUM(CASE WHEN p.IsFeatured = 1 THEN 1 ELSE 0 END) AS FeaturedPlacesCount
FROM [dbo].[Regions] r
LEFT JOIN [dbo].[Places] p ON r.RegionId = p.RegionId
GROUP BY r.RegionId, r.Name;
GO

-- 13. STORED PROCEDURES (SSMS PROGRAMMABILITY)
PRINT N'[SSMS] Създаване на съхранени процедури (Stored Procedures)...';
GO

CREATE PROCEDURE [dbo].[usp_FindNearbyPlaces]
    @Latitude FLOAT,
    @Longitude FLOAT,
    @RadiusKm FLOAT = 25.0
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Origin GEOGRAPHY = geography::Point(@Latitude, @Longitude, 4326);

    SELECT 
        p.PlaceId,
        p.Name AS PlaceName,
        c.Name AS CategoryName,
        r.Name AS RegionName,
        p.Latitude,
        p.Longitude,
        p.ElevationMeters,
        ROUND(@Origin.STDistance(p.GeoLocation) / 1000.0, 2) AS DistanceKm
    FROM [dbo].[Places] p
    INNER JOIN [dbo].[Categories] c ON p.CategoryId = c.CategoryId
    INNER JOIN [dbo].[Regions] r ON p.RegionId = r.RegionId
    WHERE p.GeoLocation.STDistance(@Origin) <= (@RadiusKm * 1000.0)
    ORDER BY DistanceKm ASC;
END;
GO

CREATE PROCEDURE [dbo].[usp_SearchCatalog]
    @SearchTerm NVARCHAR(100) = NULL,
    @CategoryId NVARCHAR(50) = NULL,
    @RegionId NVARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        p.PlaceId,
        p.Name,
        c.Name AS Category,
        r.Name AS Region,
        p.Difficulty,
        p.ElevationMeters,
        p.ShortDescription
    FROM [dbo].[Places] p
    INNER JOIN [dbo].[Categories] c ON p.CategoryId = c.CategoryId
    INNER JOIN [dbo].[Regions] r ON p.RegionId = r.RegionId
    WHERE 
        (@SearchTerm IS NULL OR p.Name LIKE N'%' + @SearchTerm + N'%' OR p.ShortDescription LIKE N'%' + @SearchTerm + N'%')
        AND (@CategoryId IS NULL OR p.CategoryId = @CategoryId)
        AND (@RegionId IS NULL OR p.RegionId = @RegionId)
    ORDER BY p.IsFeatured DESC, p.Name ASC;
END;
GO

PRINT N'=========================================================================';
PRINT N'[SSMS] БАЗАТА ДАННИ BULGARIATRAVEL Е ИНИЦИАЛИЗИРАНА УСПЕШНО!';
PRINT N'Всички 48 обекта, 6 региона, 6 категории, пространствени индекси и изгледи';
PRINT N'са готови за управление през SQL Server Management Studio (SSMS).';
PRINT N'=========================================================================';
GO
`;

fs.writeFileSync('./data/BulgariaTravel_SSMS.sql', sql, 'utf8');
console.log('Generated ./data/BulgariaTravel_SSMS.sql successfully! Total size: ' + (sql.length / 1024).toFixed(1) + ' KB');
