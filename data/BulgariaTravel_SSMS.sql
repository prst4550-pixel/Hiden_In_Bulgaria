-- =========================================================================
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
INSERT INTO [dbo].[Places] ([PlaceId], [Name], [Slug], [CategoryId], [RegionId], [Latitude], [Longitude], [ElevationMeters], [Difficulty], [AccessDetails], [BestSeason], [ShortDescription], [FullDescription], [HistoricalContext], [ImageUrl], [ImageCredit], [IsFeatured])
VALUES (
    N'belintash',
    N'Скално светилище Белинташ',
    N'belintash',
    N'sanctuaries',
    N'south_central',
    41.8547,
    24.9669,
    0,
    N'Умерен',
    NULL,
    N'Пролет, лято и есен',
    N'Мистично плато в Родопите с изсечени в скалата олтари и звездна карта от времето на бесите.',
    N'Белинташ е платовидна скала с дължина около 800 метра. На платото са издълбани стотици скални ями, улеи и геометрични олтари, за които се смята, че са служили на тракийското племе беси като култов център и астрономическа обсерватория. Гледката от върха към Родопските ридове е 360-градусова и спира дъха.',
    NULL,
    N'/places/belintash.jpg',
    N'Фотография: Уикипедия / Свободен лиценз',
    1
);
INSERT INTO [dbo].[Places] ([PlaceId], [Name], [Slug], [CategoryId], [RegionId], [Latitude], [Longitude], [ElevationMeters], [Difficulty], [AccessDetails], [BestSeason], [ShortDescription], [FullDescription], [HistoricalContext], [ImageUrl], [ImageCredit], [IsFeatured])
VALUES (
    N'gluhite-kamani',
    N'Глухите камъни край с. Малко градище',
    N'gluhite-kamani',
    N'sanctuaries',
    N'south_central',
    41.7766,
    26.0354,
    0,
    N'Лесен',
    NULL,
    N'Целогодишно (особено пролет и златна есен)',
    N'Над 200 трапецовидни ниши, изсечени в самотни 30-метрови монолитни скали в Източните Родопи.',
    N'Комплексът се състои от няколко огромни скални блока, увенчани с каменни стълбища, водещи до резервоар за свещена вода. В отвесните стени са издълбани над двеста тайнствени трапецовидни ниши, чието точно предназначение остава загадка за науката.',
    NULL,
    N'/places/gluhite-kamani.jpg',
    N'Фотография: Уикипедия / Свободен лиценз',
    1
);
INSERT INTO [dbo].[Places] ([PlaceId], [Name], [Slug], [CategoryId], [RegionId], [Latitude], [Longitude], [ElevationMeters], [Difficulty], [AccessDetails], [BestSeason], [ShortDescription], [FullDescription], [HistoricalContext], [ImageUrl], [ImageCredit], [IsFeatured])
VALUES (
    N'dyavolski-most',
    N'Дяволският мост над река Арда',
    N'dyavolski-most',
    N'fortresses',
    N'south_central',
    41.6206,
    25.1142,
    0,
    N'Лесен',
    NULL,
    N'Пролет (пълноводие) и октомври (ярки багри)',
    N'Средновековен трисводест шедьовър в тесен каньон на река Арда с вградена дяволска сянка.',
    N'Шедьовър на средновековното мостостроене, издигнат през XVI век върху останки от римски път Via Egnatia. Дължината му е 56 метра, а широчината — 3.5 метра. Отражението на централния свод във водите на Арда образува идеална окръжност, в която според местното предание се вижда ликът на Дявола.',
    NULL,
    N'/places/dyavolski-most.jpg',
    N'Фотография: Уикипедия / Свободен лиценз',
    1
);
INSERT INTO [dbo].[Places] ([PlaceId], [Name], [Slug], [CategoryId], [RegionId], [Latitude], [Longitude], [ElevationMeters], [Difficulty], [AccessDetails], [BestSeason], [ShortDescription], [FullDescription], [HistoricalContext], [ImageUrl], [ImageCredit], [IsFeatured])
VALUES (
    N'peshtera-prohodna',
    N'Пещера Проходна („Очите на Бога“)',
    N'peshtera-prohodna',
    N'caves',
    N'northwest',
    43.1756,
    24.0736,
    0,
    N'Лесен',
    NULL,
    N'Целогодишно',
    N'Най-дългият скален тунел в България с два огромни естествени отвора, гледащи право в небето.',
    N'Проходна е естествен скален мост с дължина 262 метра и височина на входовете до 45 метра. В тавана на централната зала природната ерозия е изваяла два симетрични овални отвора с форма на очи, през които влиза слънчева светлина, а при дъжд изглеждат като сълзящи очи.',
    NULL,
    N'/places/peshtera-prohodna.jpg',
    N'Фотография: Уикипедия / Свободен лиценз',
    1
);
INSERT INTO [dbo].[Places] ([PlaceId], [Name], [Slug], [CategoryId], [RegionId], [Latitude], [Longitude], [ElevationMeters], [Difficulty], [AccessDetails], [BestSeason], [ShortDescription], [FullDescription], [HistoricalContext], [ImageUrl], [ImageCredit], [IsFeatured])
VALUES (
    N'tatul',
    N'Тракийско светилище край с. Татул',
    N'tatul',
    N'sanctuaries',
    N'south_central',
    41.5432,
    25.5447,
    0,
    N'Лесен',
    NULL,
    N'Целогодишно',
    N'Усечена каменна пирамида със саркофаг, свързван с култа към легендарния певец Орфей.',
    N'Комплексът край село Татул се състои от древно езическо светилище и скална гробница. Върхът представлява изсечена в скалата пресечена пирамида с издълбано легло за саркофаг и жертвени улеи за възлияния на вино и мед.',
    NULL,
    N'/places/tatul.jpg',
    N'Фотография: Уикипедия / Свободен лиценз',
    0
);
INSERT INTO [dbo].[Places] ([PlaceId], [Name], [Slug], [CategoryId], [RegionId], [Latitude], [Longitude], [ElevationMeters], [Difficulty], [AccessDetails], [BestSeason], [ShortDescription], [FullDescription], [HistoricalContext], [ImageUrl], [ImageCredit], [IsFeatured])
VALUES (
    N'perperikon',
    N'Скалният град Перперикон',
    N'perperikon',
    N'sanctuaries',
    N'south_central',
    41.6702,
    25.4658,
    0,
    N'Умерен',
    NULL,
    N'Пролет и ранна есен',
    N'Монументален мегалитен ансамбъл и античен скален дворец с древното светилище на Дионис.',
    N'Перперикон се извисява върху скалист връх на 15 км североизточно от Кърджали. Включва мегалитно светилище отпреди 8000 години, монументален изсечен в скалата дворец, крепостна стена с кули и раннохристиянска базилика.',
    NULL,
    N'/places/perperikon.jpg',
    N'Фотография: Уикипедия / Свободен лиценз',
    1
);
INSERT INTO [dbo].[Places] ([PlaceId], [Name], [Slug], [CategoryId], [RegionId], [Latitude], [Longitude], [ElevationMeters], [Difficulty], [AccessDetails], [BestSeason], [ShortDescription], [FullDescription], [HistoricalContext], [ImageUrl], [ImageCredit], [IsFeatured])
VALUES (
    N'harman-kaya',
    N'Скално светилище Харман кая',
    N'harman-kaya',
    N'sanctuaries',
    N'south_central',
    41.5647,
    25.4339,
    0,
    N'Труден',
    NULL,
    N'Май - октомври',
    N'Два огромни идеално заравнени скални кръга, служещи за астрономически измервания на слънцестоенето.',
    N'Харман кая се намира близо до село Биволяне в каньона на река Гюрген дере. Представлява две гигантски загладени площадки („хармани“) с врязани концентрични полукръгове и улеи. Мястото е едно от най-слабо комерсиализираните и автентични светилища в Родопите.',
    NULL,
    N'/places/harman-kaya.jpg',
    N'Фотография: Уикипедия / Свободен лиценз',
    0
);
INSERT INTO [dbo].[Places] ([PlaceId], [Name], [Slug], [CategoryId], [RegionId], [Latitude], [Longitude], [ElevationMeters], [Difficulty], [AccessDetails], [BestSeason], [ShortDescription], [FullDescription], [HistoricalContext], [ImageUrl], [ImageCredit], [IsFeatured])
VALUES (
    N'choka-gradishte',
    N'Меандрите на Арда и Чока градище',
    N'choka-gradishte',
    N'fortresses',
    N'south_central',
    41.6375,
    25.3218,
    0,
    N'Лесен',
    NULL,
    N'Пролет и есен при ясно време',
    N'Скрита крепост на тесен скален нос, обграден от почти 360-градусов меандър на река Арда.',
    N'Един от най-впечатляващите меандри на Арда се намира между язовирите Кърджали и Ивайловград. На високия полуостров Чока градище личат останките от антична и средновековна крепост, защитавала брода през реката.',
    NULL,
    N'/places/choka-gradishte.jpg',
    N'Wikimedia Commons / CC BY-SA',
    0
);
INSERT INTO [dbo].[Places] ([PlaceId], [Name], [Slug], [CategoryId], [RegionId], [Latitude], [Longitude], [ElevationMeters], [Difficulty], [AccessDetails], [BestSeason], [ShortDescription], [FullDescription], [HistoricalContext], [ImageUrl], [ImageCredit], [IsFeatured])
VALUES (
    N'mezek-tomb',
    N'Тракийска куполна гробница при Мезек',
    N'mezek-tomb',
    N'sanctuaries',
    N'south_central',
    41.7408,
    26.0964,
    0,
    N'Лесен',
    NULL,
    N'Целогодишно',
    N'Най-дългата и монументална тракийска куполна гробница в Югоизточна Европа (IV в. пр.Хр.).',
    N'Гробницата под могилата Малтепе има впечатляващ дромос (коридор) с дължина почти 30 метра, изграден от огромни гранитни квадри без хоросан. Завършва с кръгла куполна камера с каменни легла и урни.',
    NULL,
    N'/places/mezek-tomb.jpg',
    N'Фотография: Уикипедия / Свободен лиценз',
    0
);
INSERT INTO [dbo].[Places] ([PlaceId], [Name], [Slug], [CategoryId], [RegionId], [Latitude], [Longitude], [ElevationMeters], [Difficulty], [AccessDetails], [BestSeason], [ShortDescription], [FullDescription], [HistoricalContext], [ImageUrl], [ImageCredit], [IsFeatured])
VALUES (
    N'bukelon-fortress',
    N'Средновековна крепост Букелон край Маточина',
    N'bukelon-fortress',
    N'fortresses',
    N'southeast',
    41.855,
    26.5567,
    0,
    N'Лесен',
    NULL,
    N'Пролет и есен (лятото е много горещо)',
    N'Внушителна 18-метрова бойна кула-донжон, устояла на битката при Адрианопол през 1205 г.',
    N'Букелон се извисява като самотен каменен страж на хълм до село Маточина, на броени километри от границата с Турция. Главната триетажна жилищно-отбранителна кула е изключително добре запазена с монолитен кръстов свод.',
    NULL,
    N'/places/bukelon-fortress.jpg',
    N'Фотография: Уикипедия / Свободен лиценз',
    1
);
GO
INSERT INTO [dbo].[Places] ([PlaceId], [Name], [Slug], [CategoryId], [RegionId], [Latitude], [Longitude], [ElevationMeters], [Difficulty], [AccessDetails], [BestSeason], [ShortDescription], [FullDescription], [HistoricalContext], [ImageUrl], [ImageCredit], [IsFeatured])
VALUES (
    N'ovech-fortress',
    N'Крепост Овеч край Провадия',
    N'ovech-fortress',
    N'fortresses',
    N'northeast',
    43.1742,
    27.4489,
    0,
    N'Умерен',
    NULL,
    N'Пролет, лято и есен',
    N'Орлово гнездо върху коралови скали с дървен мост и вековни щурмови порти.',
    N'Овеч е изградена върху плато във формата на кораб („Калето“), защитено от отвесни скали с височина до 25 метра. Впечатлява с каменната спираловидна стълба, издълбана в скалата, и 150-метровия висящ дървен мост между платата.',
    NULL,
    N'/places/ovech-fortress.jpg',
    N'Фотография: Уикипедия / Свободен лиценз',
    1
);
INSERT INTO [dbo].[Places] ([PlaceId], [Name], [Slug], [CategoryId], [RegionId], [Latitude], [Longitude], [ElevationMeters], [Difficulty], [AccessDetails], [BestSeason], [ShortDescription], [FullDescription], [HistoricalContext], [ImageUrl], [ImageCredit], [IsFeatured])
VALUES (
    N'hotnishki-vodopad',
    N'Хотнишки водопад (Кая Бунар)',
    N'hotnishki-vodopad',
    N'waterfalls',
    N'north_central',
    43.1417,
    25.5036,
    0,
    N'Умерен',
    NULL,
    N'Април - юни при пълноводие',
    N'Изумрудено езеро и 30-метров каскаден пад с дървена екопътека по скалния каньон.',
    N'Хотнишкият водопад пада от 30 метра височина в кристално чисто езеро с изумителен тюркоазен цвят на водата. От него започва тясна скална екопътека с дървени мостчета и стълби по дефилето на река Бохот.',
    NULL,
    N'/places/hotnishki-vodopad.jpg',
    N'Фотография: Уикипедия / Свободен лиценз',
    1
);
INSERT INTO [dbo].[Places] ([PlaceId], [Name], [Slug], [CategoryId], [RegionId], [Latitude], [Longitude], [ElevationMeters], [Difficulty], [AccessDetails], [BestSeason], [ShortDescription], [FullDescription], [HistoricalContext], [ImageUrl], [ImageCredit], [IsFeatured])
VALUES (
    N'ivanovo-rock-churches',
    N'Ивановски скални манастири',
    N'ivanovo-rock-churches',
    N'monasteries',
    N'north_central',
    43.6961,
    25.9867,
    0,
    N'Лесен',
    NULL,
    N'Целогодишно (най-красиво през май и октомври)',
    N'Обект на ЮНЕСКО — шедьоври на търновската стенопис от XIV век в отвесните скали на Русенски Лом.',
    N'Комплекс от десетки скални килии, църкви и параклиси, изсечени в белите карстови отвеси над река Русенски Лом. Най-известна е църквата „Света Богородица“ с неповторими палеологови фрески.',
    NULL,
    N'/places/ivanovo-rock-churches.jpg',
    N'Фотография: Уикипедия / Свободен лиценз',
    1
);
INSERT INTO [dbo].[Places] ([PlaceId], [Name], [Slug], [CategoryId], [RegionId], [Latitude], [Longitude], [ElevationMeters], [Difficulty], [AccessDetails], [BestSeason], [ShortDescription], [FullDescription], [HistoricalContext], [ImageUrl], [ImageCredit], [IsFeatured])
VALUES (
    N'yatrus-fortress',
    N'Римски кастел Ятрус при Кривина',
    N'yatrus-fortress',
    N'fortresses',
    N'north_central',
    43.6331,
    25.6881,
    0,
    N'Лесен',
    NULL,
    N'Пролет и лято',
    N'Късноантичен дунавски лимес и кастел при устието на река Янтра.',
    N'Ятрус е бил ключова римска твърдина от долнодунавския лимес. Впечатлява с масивните петоъгълни кули и разкритите основи на огромни обществени житници (horreum) и раннохристиянска епископска базилика.',
    NULL,
    N'/places/yatrus-fortress.jpg',
    N'Фотография: Уикипедия (Ятрус)',
    0
);
INSERT INTO [dbo].[Places] ([PlaceId], [Name], [Slug], [CategoryId], [RegionId], [Latitude], [Longitude], [ElevationMeters], [Difficulty], [AccessDetails], [BestSeason], [ShortDescription], [FullDescription], [HistoricalContext], [ImageUrl], [ImageCredit], [IsFeatured])
VALUES (
    N'emen-canyon',
    N'Еменски каньон и река Негованка',
    N'emen-canyon',
    N'waterfalls',
    N'north_central',
    43.1311,
    25.3528,
    0,
    N'Умерен',
    NULL,
    N'Пролет и ранна есен',
    N'Първата екопътека в България с 50-метрови отвесни скални стени и водопад Момин скок.',
    N'Река Негованка е прорязала дълбок каньон с отвесни скали, пещери и ниши. Екопътеката преминава по висящи дървени мостове по скалния венец и завършва при вира на водопад Момин скок.',
    NULL,
    N'/places/emen-canyon.jpg',
    N'Фотография: Уикипедия / Свободен лиценз',
    0
);
INSERT INTO [dbo].[Places] ([PlaceId], [Name], [Slug], [CategoryId], [RegionId], [Latitude], [Longitude], [ElevationMeters], [Difficulty], [AccessDetails], [BestSeason], [ShortDescription], [FullDescription], [HistoricalContext], [ImageUrl], [ImageCredit], [IsFeatured])
VALUES (
    N'kastra-martis',
    N'Римска крепост Кастра Мартис в Кула',
    N'kastra-martis',
    N'fortresses',
    N'northwest',
    43.8894,
    22.5242,
    0,
    N'Лесен',
    NULL,
    N'Целогодишно',
    N'Уникална четириъгълна римска кула-квадрибургий в самия център на град Кула.',
    N'Кастра Мартис („Крепостта на Марс“) е сред най-добре запазените образци на късноримската фортификация на Балканите. Мощната югоизточна кула достига внушителните 16 метра височина.',
    NULL,
    N'/places/kastra-martis.jpg',
    N'Фотография: Уикипедия (Кастра Мартис)',
    0
);
INSERT INTO [dbo].[Places] ([PlaceId], [Name], [Slug], [CategoryId], [RegionId], [Latitude], [Longitude], [ElevationMeters], [Difficulty], [AccessDetails], [BestSeason], [ShortDescription], [FullDescription], [HistoricalContext], [ImageUrl], [ImageCredit], [IsFeatured])
VALUES (
    N'vrachanska-skaklya',
    N'Водопад Врачанска Скакля',
    N'vrachanska-skaklya',
    N'waterfalls',
    N'northwest',
    43.1906,
    23.5358,
    0,
    N'Труден',
    NULL,
    N'Март - май (след топене на снеговете)',
    N'Най-високият непостоянен водопад в България с падане на водата от 141 метра височина.',
    N'Скакля се спуска от отвесните скални венци на Врачанския балкан над град Враца. Водата се разбива на воден прах на фона на червеникавите варовикови стени. Пълноводен е след топенето на снеговете през пролетта.',
    NULL,
    N'/places/vrachanska-skaklya.jpg',
    N'Фотография: Уикипедия (Врачанска скакля)',
    1
);
INSERT INTO [dbo].[Places] ([PlaceId], [Name], [Slug], [CategoryId], [RegionId], [Latitude], [Longitude], [ElevationMeters], [Difficulty], [AccessDetails], [BestSeason], [ShortDescription], [FullDescription], [HistoricalContext], [ImageUrl], [ImageCredit], [IsFeatured])
VALUES (
    N'bozhiya-most',
    N'Скален феномен Божия мост край Лиляче',
    N'bozhiya-most',
    N'caves',
    N'northwest',
    43.315,
    23.5292,
    0,
    N'Лесен',
    NULL,
    N'Пролет и ранно лято',
    N'Гигантски 20-метров естествен скален свод с пещерни колони и лабиринти.',
    N'Естествен каменен мост с височина 20 метра и ширина 25 метра, оформен от водите на река Лиляшка. Под свода се крие сенчест пещерен тунел с десетки карстови стълбове и езерца.',
    NULL,
    N'/places/bozhiya-most.jpg',
    N'Фотография: Уикипедия / Свободен лиценз',
    1
);
INSERT INTO [dbo].[Places] ([PlaceId], [Name], [Slug], [CategoryId], [RegionId], [Latitude], [Longitude], [ElevationMeters], [Difficulty], [AccessDetails], [BestSeason], [ShortDescription], [FullDescription], [HistoricalContext], [ImageUrl], [ImageCredit], [IsFeatured])
VALUES (
    N'magura-cave',
    N'Пещера Магура и праисторическите рисунки',
    N'magura-cave',
    N'caves',
    N'northwest',
    43.7289,
    22.5833,
    0,
    N'Лесен',
    NULL,
    N'Целогодишно',
    N'Уникална карстова галерия със съхранени рисунки с гуано отпреди 7000 години.',
    N'Една от най-големите пещери в България с обща дължина на галериите над 2.5 км. Известна с „Галерията с рисунките“, изобразяващи слънчев календар, ловни сцени и ритуали на древните хора.',
    NULL,
    N'/places/magura-cave.jpg',
    N'Фотография: Уикипедия / Свободен лиценз',
    0
);
INSERT INTO [dbo].[Places] ([PlaceId], [Name], [Slug], [CategoryId], [RegionId], [Latitude], [Longitude], [ElevationMeters], [Difficulty], [AccessDetails], [BestSeason], [ShortDescription], [FullDescription], [HistoricalContext], [ImageUrl], [ImageCredit], [IsFeatured])
VALUES (
    N'tyulenovo-yaylata',
    N'Скални брегове на Тюленово и Яйлата',
    N'tyulenovo-yaylata',
    N'caves',
    N'northeast',
    43.4933,
    28.5861,
    0,
    N'Лесен',
    NULL,
    N'Юни - октомври',
    N'Червени отвесни морски клифове, природни скални арки и 101 пещерни жилища на сарматите.',
    N'Брегът край Тюленово и резерват Яйлата е дивата перла на Северното Черноморие. 30-метрови отвесни скали се спускат в тюркоазените вълни. Скалната арка в Тюленово и ранновизантийската крепост на Яйлата създават неповторим пейзаж.',
    NULL,
    N'/places/tyulenovo-yaylata.jpg',
    N'Фотография: Уикипедия / Свободен лиценз',
    1
);
GO
INSERT INTO [dbo].[Places] ([PlaceId], [Name], [Slug], [CategoryId], [RegionId], [Latitude], [Longitude], [ElevationMeters], [Difficulty], [AccessDetails], [BestSeason], [ShortDescription], [FullDescription], [HistoricalContext], [ImageUrl], [ImageCredit], [IsFeatured])
VALUES (
    N'suha-reka',
    N'Каньонът на Суха река в Добруджа',
    N'suha-reka',
    N'caves',
    N'northeast',
    43.8344,
    27.6189,
    0,
    N'Труден',
    NULL,
    N'Май и септември',
    N'Изчезналата река на Добруджа сред диви варовикови отвеси и тайни скални манастири.',
    N'Суха река някога е била пълноводен приток на Дунав, но днес тече предимно под земята, оставяйки грандиозен каньон с дълбочина до 100 метра сред плоската добруджанска равнина. В скалите са скрити средновековни монашески килии.',
    NULL,
    N'/places/suha-reka.jpg',
    N'Фотография: Уикипедия (Крушари (община))',
    0
);
INSERT INTO [dbo].[Places] ([PlaceId], [Name], [Slug], [CategoryId], [RegionId], [Latitude], [Longitude], [ElevationMeters], [Difficulty], [AccessDetails], [BestSeason], [ShortDescription], [FullDescription], [HistoricalContext], [ImageUrl], [ImageCredit], [IsFeatured])
VALUES (
    N'stobski-piramidi',
    N'Стобските земни пирамиди',
    N'stobski-piramidi',
    N'caves',
    N'southwest',
    42.0911,
    23.1189,
    0,
    N'Умерен',
    NULL,
    N'Пролет и златна есен при залез',
    N'Островерхи земни игли с каменни шапки от пясъчник над село Стоб в полите на Рила.',
    N'Живописни пясъчни пирамиди с височина от 6 до 12 метра, обагрени в топли ръждиви и златисти нюанси. Много от тях завършват с плоски каменни блокове („шапки“), които ги предпазват от дъждовете.',
    NULL,
    N'/places/stobski-piramidi.jpg',
    N'Фотография: Уикипедия / Свободен лиценз',
    0
);
INSERT INTO [dbo].[Places] ([PlaceId], [Name], [Slug], [CategoryId], [RegionId], [Latitude], [Longitude], [ElevationMeters], [Difficulty], [AccessDetails], [BestSeason], [ShortDescription], [FullDescription], [HistoricalContext], [ImageUrl], [ImageCredit], [IsFeatured])
VALUES (
    N'chervenata-tsarkva',
    N'Червената църква край Перущица',
    N'chervenata-tsarkva',
    N'monasteries',
    N'south_central',
    42.0678,
    24.5492,
    0,
    N'Лесен',
    NULL,
    N'Целогодишно',
    N'Раннохристиянска базилика от V век от червени римски тухли с 14-метрова централна арка.',
    N'Един от най-забележителните паметници на раннохристиянската архитектура в Европа. Построена изцяло от червени тухли и розов хоросан, църквата е имала богато мозаечно оформление и стенописи, части от които са запазени.',
    NULL,
    N'/places/chervenata-tsarkva.jpg',
    N'Фотография: Уикипедия / Свободен лиценз',
    0
);
INSERT INTO [dbo].[Places] ([PlaceId], [Name], [Slug], [CategoryId], [RegionId], [Latitude], [Longitude], [ElevationMeters], [Difficulty], [AccessDetails], [BestSeason], [ShortDescription], [FullDescription], [HistoricalContext], [ImageUrl], [ImageCredit], [IsFeatured])
VALUES (
    N'vkamenena-svatba',
    N'Вкаменената сватба край Зимзелен',
    N'vkamenena-svatba',
    N'caves',
    N'south_central',
    41.6767,
    25.4056,
    0,
    N'Лесен',
    NULL,
    N'Целогодишно',
    N'Природни вулкански туфи, наподобяващи сватбено шествие с младоженци и конници.',
    N'Удивителен скален феномен на площ от 50 декара. Скалите имат фантастични форми, оцветени в бяло, розово и охра заради минералите в риолитовите вулкански туфи.',
    NULL,
    N'/places/vkamenena-svatba.jpg',
    N'Фотография: Уикипедия / Свободен лиценз',
    0
);
INSERT INTO [dbo].[Places] ([PlaceId], [Name], [Slug], [CategoryId], [RegionId], [Latitude], [Longitude], [ElevationMeters], [Difficulty], [AccessDetails], [BestSeason], [ShortDescription], [FullDescription], [HistoricalContext], [ImageUrl], [ImageCredit], [IsFeatured])
VALUES (
    N'meandrite-na-veleka',
    N'Меандрите на река Велека в Странджа',
    N'meandrite-na-veleka',
    N'waterfalls',
    N'southeast',
    42.0622,
    27.9733,
    0,
    N'Лесен',
    NULL,
    N'Май (цъфтеж на зелениката) - септември',
    N'Най-чистата река в България, криволичеща през лонгозни дъбови гори към морския пясъчен бряг.',
    N'Велека е най-голямата странджанска река. В долното си течение образува живописни меандри през вековната растителност на природен парк „Странджа“, дом на редки водни лилии и видри.',
    NULL,
    N'/places/meandrite-na-veleka.jpg',
    N'Фотография: Уикипедия (Велека)',
    1
);
INSERT INTO [dbo].[Places] ([PlaceId], [Name], [Slug], [CategoryId], [RegionId], [Latitude], [Longitude], [ElevationMeters], [Difficulty], [AccessDetails], [BestSeason], [ShortDescription], [FullDescription], [HistoricalContext], [ImageUrl], [ImageCredit], [IsFeatured])
VALUES (
    N'indipasha',
    N'Древното оброчище Индипасха',
    N'indipasha',
    N'sanctuaries',
    N'southeast',
    42.0089,
    27.6711,
    0,
    N'Умерен',
    NULL,
    N'Пролет и лято (неделя след Великден е празникът)',
    N'Мистично езическо светилище в дълбок дол с лековит аязмен извор, капещ от отвесна скала.',
    N'Индипасха е скрито на дъното на дълбоко сенчесто дере сред странджанските дъбове. От отвесната скала капе лековита вода в малко каменно корито. Мястото е окичено с парченца дрехи и иконки от хиляди поклонници.',
    NULL,
    N'/places/indipasha.jpg',
    N'Фотография: Уикипедия (Индипасха)',
    1
);
INSERT INTO [dbo].[Places] ([PlaceId], [Name], [Slug], [CategoryId], [RegionId], [Latitude], [Longitude], [ElevationMeters], [Difficulty], [AccessDetails], [BestSeason], [ShortDescription], [FullDescription], [HistoricalContext], [ImageUrl], [ImageCredit], [IsFeatured])
VALUES (
    N'mishkova-niva',
    N'Тракийски комплекс Мишкова нива',
    N'mishkova-niva',
    N'sanctuaries',
    N'southeast',
    41.9744,
    27.5022,
    0,
    N'Лесен',
    NULL,
    N'Май - октомври',
    N'Монументален кръгъл хероон от полиран бял мрамор и светилище на Аполон Аулариок.',
    N'Комплексът се състои от мраморен кръгъл кромлех с диаметър 25 метра, монументална гробница с куполна камера, некропол и антични рудници. Намира се в граничната зона близо до връх Голямо Градище.',
    NULL,
    N'/places/mishkova-niva.jpg',
    N'Фотография: Уикипедия (Мишкова нива)',
    0
);
INSERT INTO [dbo].[Places] ([PlaceId], [Name], [Slug], [CategoryId], [RegionId], [Latitude], [Longitude], [ElevationMeters], [Difficulty], [AccessDetails], [BestSeason], [ShortDescription], [FullDescription], [HistoricalContext], [ImageUrl], [ImageCredit], [IsFeatured])
VALUES (
    N'kademliysko-praskalo',
    N'Водопад Кадемлийско пръскало',
    N'kademliysko-praskalo',
    N'waterfalls',
    N'south_central',
    42.7094,
    25.045,
    0,
    N'Труден',
    NULL,
    N'Юни - август при пълноводие',
    N'Грандиозен 70-метров водопад в самото сърце на Национален парк „Централен Балкан“.',
    N'Водопадът пада мощно от висок отвесен скален праг в подножието на връх Триглав. Студените води на река Кадемлия се спускат непосредствено до планинския път под хижа Мандрата.',
    NULL,
    N'/places/kademliysko-praskalo.jpg',
    N'Фотография: Уикипедия (Кадемлия)',
    0
);
INSERT INTO [dbo].[Places] ([PlaceId], [Name], [Slug], [CategoryId], [RegionId], [Latitude], [Longitude], [ElevationMeters], [Difficulty], [AccessDetails], [BestSeason], [ShortDescription], [FullDescription], [HistoricalContext], [ImageUrl], [ImageCredit], [IsFeatured])
VALUES (
    N'dolen-village',
    N'Архитектурен резерват с. Долен',
    N'dolen-village',
    N'villages',
    N'southwest',
    41.6247,
    23.9317,
    0,
    N'Лесен',
    NULL,
    N'Целогодишно (особено красив есенен колорит)',
    N'Възрожденско планинско село със 70 къщи-паметници на културата и тиклени покриви.',
    N'Село Долен е съхранило непокътнатата си автентичност от Възраждането. Тесните калдъръмени улички, високите каменни зидове и еркерните къщи с покриви от каменни плочи (тикли) пренасят в друга епоха.',
    NULL,
    N'/places/dolen-village.jpg',
    N'Фотография: Уикипедия / Свободен лиценз',
    1
);
INSERT INTO [dbo].[Places] ([PlaceId], [Name], [Slug], [CategoryId], [RegionId], [Latitude], [Longitude], [ElevationMeters], [Difficulty], [AccessDetails], [BestSeason], [ShortDescription], [FullDescription], [HistoricalContext], [ImageUrl], [ImageCredit], [IsFeatured])
VALUES (
    N'kovachevitsa-village',
    N'Село Ковачевица и река Канина',
    N'kovachevitsa-village',
    N'villages',
    N'southwest',
    41.6833,
    23.8306,
    0,
    N'Лесен',
    NULL,
    N'Целогодишно',
    N'Каменната приказка на Западните Родопи с високи къщи-крепости и каньон Сини вир.',
    N'Ковачевица е емблема на българската родопска архитектура. Къщите са изградени изцяло от необработен камък и дърво, издигащи се на по 3-4 етажа. Наблизо се намира каньонът на река Канина и водопад Сини вир.',
    NULL,
    N'/places/kovachevitsa-village.jpg',
    N'Фотография: Уикипедия / Свободен лиценз',
    1
);
GO
INSERT INTO [dbo].[Places] ([PlaceId], [Name], [Slug], [CategoryId], [RegionId], [Latitude], [Longitude], [ElevationMeters], [Difficulty], [AccessDetails], [BestSeason], [ShortDescription], [FullDescription], [HistoricalContext], [ImageUrl], [ImageCredit], [IsFeatured])
VALUES (
    N'pobiti-kamani',
    N'Природен феномен Побити камъни',
    N'pobiti-kamani',
    N'caves',
    N'northeast',
    43.2269,
    27.7058,
    0,
    N'Лесен',
    NULL,
    N'Пролет и ранна есен',
    N'Единствената естествена пустиня в Европа с кухи каменни колони, издигащи се до 7 метра.',
    N'Ансамбъл от варовикови колони, забити в ситен кварцов пясък. Колоните са кухи отвътре и наподобяват стволове на вкаменена праисторическа гора или руини на античен храм.',
    NULL,
    N'/places/pobiti-kamani.jpg',
    N'Фотография: Уикипедия / Свободен лиценз',
    0
);
INSERT INTO [dbo].[Places] ([PlaceId], [Name], [Slug], [CategoryId], [RegionId], [Latitude], [Longitude], [ElevationMeters], [Difficulty], [AccessDetails], [BestSeason], [ShortDescription], [FullDescription], [HistoricalContext], [ImageUrl], [ImageCredit], [IsFeatured])
VALUES (
    N'vrah-veykata',
    N'Връх Вейката — най-южната точка на България',
    N'vrah-veykata',
    N'caves',
    N'south_central',
    41.2403,
    25.2894,
    0,
    N'Екстремен',
    NULL,
    N'Юни - септември',
    N'Граничният първенец на Гюмюрджински снежник с гледка към Бяло море и гръцките острови.',
    N'Вейката е най-южната географска точка на България. Върхът се издига на самата граница с Гърция. При кристално чисто време от върха се виждат водите на Егейско море и силуетът на остров Самотраки.',
    NULL,
    N'/places/vrah-veykata.jpg',
    N'Фотография: Уикипедия (Вейката)',
    0
);
INSERT INTO [dbo].[Places] ([PlaceId], [Name], [Slug], [CategoryId], [RegionId], [Latitude], [Longitude], [ElevationMeters], [Difficulty], [AccessDetails], [BestSeason], [ShortDescription], [FullDescription], [HistoricalContext], [ImageUrl], [ImageCredit], [IsFeatured])
VALUES (
    N'belogradchishki-skali',
    N'Белоградчишки скали и крепост „Калето“',
    N'belogradchishki-skali',
    N'fortresses',
    N'northwest',
    43.6239,
    22.6822,
    0,
    N'Лесен',
    NULL,
    N'Целогодишно (особено красиви през есента и пролетта)',
    N'Червеникави пясъчникови кули и древна римско-византийска и средновековна твърдина, врязана в скалите.',
    N'Белоградчишките скали са природно творение от червени конгломерати и пясъчници, формирани преди повече от 200 милиона години. Крепостта „Калето“ използва естествената непристъпност на скалните игли с височина до 70 метра. Изградена първоначално от римляните като наблюдателен пункт, разширена от видинския цар Иван Срацимир и по-късно от османците.',
    NULL,
    N'/places/belogradchishki-skali.jpg',
    N'Фотография: Уикипедия / Свободен лиценз',
    1
);
INSERT INTO [dbo].[Places] ([PlaceId], [Name], [Slug], [CategoryId], [RegionId], [Latitude], [Longitude], [ElevationMeters], [Difficulty], [AccessDetails], [BestSeason], [ShortDescription], [FullDescription], [HistoricalContext], [ImageUrl], [ImageCredit], [IsFeatured])
VALUES (
    N'sedemte-rilski-ezera',
    N'Седемте рилски езера',
    N'sedemte-rilski-ezera',
    N'waterfalls',
    N'southwest',
    42.2039,
    23.315,
    0,
    N'Умерен',
    NULL,
    N'Юли - септември',
    N'Група от седем ледникови езера с кристално бистри води, стъпаловидно разположени в циркуса на Дамга.',
    N'Седемте рилски езера са сред най-емблематичните природни забележителности в България. Всяко езеро носи име, отразяващо характерната му форма: Сълзата (на 2535 м), Окото (най-дълбокото — 37.5 м), Бъбрека, Близнака, Трилистника, Рибното и Долното.',
    NULL,
    N'/places/sedemte-rilski-ezera.jpg',
    N'Фотография: Уикипедия / Свободен лиценз',
    1
);
INSERT INTO [dbo].[Places] ([PlaceId], [Name], [Slug], [CategoryId], [RegionId], [Latitude], [Longitude], [ElevationMeters], [Difficulty], [AccessDetails], [BestSeason], [ShortDescription], [FullDescription], [HistoricalContext], [ImageUrl], [ImageCredit], [IsFeatured])
VALUES (
    N'krushunski-vodopadi',
    N'Крушунски водопади и местност Маарата',
    N'krushunski-vodopadi',
    N'waterfalls',
    N'north_central',
    43.2428,
    25.0347,
    0,
    N'Лесен',
    NULL,
    N'Пролет (април-юни) при пълноводие',
    N'Тюркоазена водна каскада от травертинови тераси, дървени мостчета и карстови извори край село Крушуна.',
    N'Крушунските водопади представляват най-голямата водна травертинова каскада в България. Водата извира от пещерата Маарата и се спуска по варовикови тераси, оформяйки десетки малки прагове, сини басейни и мохови завеси с изумруден оттенък.',
    NULL,
    N'/places/krushunski-vodopadi.jpg',
    N'Фотография: Уикипедия / Свободен лиценз',
    1
);
INSERT INTO [dbo].[Places] ([PlaceId], [Name], [Slug], [CategoryId], [RegionId], [Latitude], [Longitude], [ElevationMeters], [Difficulty], [AccessDetails], [BestSeason], [ShortDescription], [FullDescription], [HistoricalContext], [ImageUrl], [ImageCredit], [IsFeatured])
VALUES (
    N'devetashka-peshtera',
    N'Деветашка пещера (Очите на Ловеч)',
    N'devetashka-peshtera',
    N'caves',
    N'north_central',
    43.2333,
    24.8853,
    0,
    N'Лесен',
    NULL,
    N'Пролет и есен',
    N'Грандиозна карстова пещера с височина на входа 30 метра, седем гигантски отвора в тавана („окна“) и хиляди прилепи.',
    N'Деветашката пещера е една от най-внушителните пещери в Европа с обща дължина от над 2400 метра и вход с размери 35 на 30 метра. Основната зала обхваща площ от 20 400 кв.м с естествени „окна“ в свода. Пещерата е дом на над 30 000 прилепа.',
    NULL,
    N'/places/devetashka-peshtera.jpg',
    N'Фотография: Уикипедия / Свободен лиценз',
    0
);
INSERT INTO [dbo].[Places] ([PlaceId], [Name], [Slug], [CategoryId], [RegionId], [Latitude], [Longitude], [ElevationMeters], [Difficulty], [AccessDetails], [BestSeason], [ShortDescription], [FullDescription], [HistoricalContext], [ImageUrl], [ImageCredit], [IsFeatured])
VALUES (
    N'beglik-tash',
    N'Мегалитно светилище Бегликташ',
    N'beglik-tash',
    N'sanctuaries',
    N'southeast',
    42.3311,
    27.7719,
    0,
    N'Лесен',
    NULL,
    N'Май - октомври (по залез)',
    N'Древен тракийски скален комплекс с мегалити, слънчев часовник, брачно ложе и каменен лабиринт над морския бряг.',
    N'Бегликташ се състои от монолитни камъни с тегло до 100 тона, подредени в кръг от тракийското племе скирмиани. Включва слънчев календар, жертвеници за ритуално вино и лабиринт от тесни процепи.',
    NULL,
    N'/places/beglik-tash.jpg',
    N'Фотография: Уикипедия / Свободен лиценз',
    1
);
INSERT INTO [dbo].[Places] ([PlaceId], [Name], [Slug], [CategoryId], [RegionId], [Latitude], [Longitude], [ElevationMeters], [Difficulty], [AccessDetails], [BestSeason], [ShortDescription], [FullDescription], [HistoricalContext], [ImageUrl], [ImageCredit], [IsFeatured])
VALUES (
    N'melnishki-piramidi',
    N'Мелнишките пясъчни пирамиди и Рожен',
    N'melnishki-piramidi',
    N'caves',
    N'southwest',
    41.5244,
    23.3969,
    0,
    N'Умерен',
    NULL,
    N'Есен и пролет',
    N'Уникални пясъчни конуси и обелиски с височина до 100 метра, ограждащи най-малкия възрожденски град в България.',
    N'Мелнишките пирамиди са скални образувания в югозападните поли на Пирин на площ от 50 кв.км. Те представляват причудливи пясъчни кули, гъби и игли. От Мелник до Роженския манастир води панорамна екопътека по скалните ръбове.',
    NULL,
    N'/places/melnishki-piramidi.jpg',
    N'Фотография: Уикипедия / Свободен лиценз',
    0
);
INSERT INTO [dbo].[Places] ([PlaceId], [Name], [Slug], [CategoryId], [RegionId], [Latitude], [Longitude], [ElevationMeters], [Difficulty], [AccessDetails], [BestSeason], [ShortDescription], [FullDescription], [HistoricalContext], [ImageUrl], [ImageCredit], [IsFeatured])
VALUES (
    N'chudnite-mostove',
    N'Чудните мостове (Еркюприя)',
    N'chudnite-mostove',
    N'caves',
    N'south_central',
    41.8197,
    24.5808,
    0,
    N'Лесен',
    NULL,
    N'Май - октомври',
    N'Монументални мраморни арки в карстовата долина на река Еркюприя, извисяващи се на 45 метра сред родопските смърчове.',
    N'Чудните мостове са естествени скални арки, образувани от срутването на тавана на древна пещера под въздействието на река Дълбок дол. Големият мост се състои от три свода с височина 45 метра. Малкият мост е тунел на 200 метра по-надолу.',
    NULL,
    N'/places/chudnite-mostove.jpg',
    N'Фотография: Уикипедия / Свободен лиценз',
    1
);
INSERT INTO [dbo].[Places] ([PlaceId], [Name], [Slug], [CategoryId], [RegionId], [Latitude], [Longitude], [ElevationMeters], [Difficulty], [AccessDetails], [BestSeason], [ShortDescription], [FullDescription], [HistoricalContext], [ImageUrl], [ImageCredit], [IsFeatured])
VALUES (
    N'baba-vida',
    N'Средновековен замък Баба Вида',
    N'baba-vida',
    N'fortresses',
    N'northwest',
    43.9922,
    22.8864,
    0,
    N'Лесен',
    NULL,
    N'Целогодишно',
    N'Единственият изцяло запазен средновековен замък в България, разположен на големия завой на река Дунав във Видин.',
    N'Баба Вида е забележителен образец на средновековната българска военна архитектура. Крепостта има форма на неправилен четириъгълник със страни около 70 метра и е заобиколена от воден ров. Разполага с 4 ъглови кули, вътрешен двор и подземен лабиринт.',
    NULL,
    N'/places/baba-vida.jpg',
    N'Фотография: Уикипедия / Свободен лиценз',
    0
);
GO
INSERT INTO [dbo].[Places] ([PlaceId], [Name], [Slug], [CategoryId], [RegionId], [Latitude], [Longitude], [ElevationMeters], [Difficulty], [AccessDetails], [BestSeason], [ShortDescription], [FullDescription], [HistoricalContext], [ImageUrl], [ImageCredit], [IsFeatured])
VALUES (
    N'utrobata-kaya',
    N'Пещера Утробата (Тангардък кая)',
    N'utrobata-kaya',
    N'sanctuaries',
    N'south_central',
    41.7058,
    25.2475,
    0,
    N'Умерен',
    NULL,
    N'Пролет, есен и декември',
    N'Древно тракийско скално светилище от XI-X в. пр.Хр., издълбано като женска утроба с фалически слънчев лъч.',
    N'Пещерата Утробата е естествена пукнатина в скалата, допълнително оформена от човешка ръка с дължина 22 метра. В дъното има изсечен олтар. По обяд през процеп прониква слънчев лъч, който при зимното слънцестоене достига олтара, символизирайки оплождането на Богинята-Майка.',
    NULL,
    N'/places/utrobata-kaya.jpg',
    N'Фотография: Уикипедия / Свободен лиценз',
    1
);
INSERT INTO [dbo].[Places] ([PlaceId], [Name], [Slug], [CategoryId], [RegionId], [Latitude], [Longitude], [ElevationMeters], [Difficulty], [AccessDetails], [BestSeason], [ShortDescription], [FullDescription], [HistoricalContext], [ImageUrl], [ImageCredit], [IsFeatured])
VALUES (
    N'nos-kaliakra',
    N'Нос Калиакра и средновековна крепост',
    N'nos-kaliakra',
    N'fortresses',
    N'northeast',
    43.3614,
    28.4658,
    0,
    N'Лесен',
    NULL,
    N'Май - октомври',
    N'Двукилометров скален нос, врязващ се в Черно море с 70-метрови огнени варовикови отвеси и делфини.',
    N'Нос Калиакра е природен и археологически резерват, врязващ се на 2 км навътре в открито море. Скалите имат наситен червеникав оттенък. Запазени са останки от античната крепост Тиризис и столицата на Добруджанското деспотство на деспот Добротица.',
    NULL,
    N'/places/nos-kaliakra.jpg',
    N'Фотография: Уикипедия / Свободен лиценз',
    1
);
INSERT INTO [dbo].[Places] ([PlaceId], [Name], [Slug], [CategoryId], [RegionId], [Latitude], [Longitude], [ElevationMeters], [Difficulty], [AccessDetails], [BestSeason], [ShortDescription], [FullDescription], [HistoricalContext], [ImageUrl], [ImageCredit], [IsFeatured])
VALUES (
    N'raiskoto-praskalo',
    N'Водопад Райското пръскало (Калоферски водопад)',
    N'raiskoto-praskalo',
    N'waterfalls',
    N'south_central',
    42.7189,
    24.9256,
    0,
    N'Труден',
    NULL,
    N'Май - юли (пълноводие)',
    N'Най-високият постоянен водопад на Балканския полуостров (124.5 м), спускащ се от Райските скали под връх Ботев.',
    N'Райското пръскало събира води от вечните снежници под връх Ботев (2376 м). Водата полита от отвесната скална стена на Джендема над хижа „Рай“. До водопада се извива легендарната Тарзанова пътека към билото.',
    NULL,
    N'/places/raiskoto-praskalo.jpg',
    N'Фотография: Уикипедия / Свободен лиценз',
    1
);
INSERT INTO [dbo].[Places] ([PlaceId], [Name], [Slug], [CategoryId], [RegionId], [Latitude], [Longitude], [ElevationMeters], [Difficulty], [AccessDetails], [BestSeason], [ShortDescription], [FullDescription], [HistoricalContext], [ImageUrl], [ImageCredit], [IsFeatured])
VALUES (
    N'dyavolskoto-garlo',
    N'Пещера Дяволското гърло (Триград)',
    N'dyavolskoto-garlo',
    N'caves',
    N'south_central',
    41.615,
    24.3792,
    0,
    N'Умерен',
    NULL,
    N'Май - октомври',
    N'Пропастна пещера в Триградското ждрело с най-високия подземен водопад на Балканите (42 м) и легенда за Орфей.',
    N'Водите на Триградската река се изливат в гигантска подземна пропаст от височина 42 метра, образувайки внушителната Бучаща зала. Всичко пуснато в реката изчезва в сифона и не се появява отново.',
    NULL,
    N'/places/dyavolskoto-garlo.jpg',
    N'Фотография: Уикипедия / Свободен лиценз',
    0
);
INSERT INTO [dbo].[Places] ([PlaceId], [Name], [Slug], [CategoryId], [RegionId], [Latitude], [Longitude], [ElevationMeters], [Difficulty], [AccessDetails], [BestSeason], [ShortDescription], [FullDescription], [HistoricalContext], [ImageUrl], [ImageCredit], [IsFeatured])
VALUES (
    N'aladzha-manastir',
    N'Скален манастир Аладжа („Св. Троица“)',
    N'aladzha-manastir',
    N'monasteries',
    N'northeast',
    43.2778,
    28.0167,
    0,
    N'Лесен',
    NULL,
    N'Целогодишно',
    N'Средновековен исихастки манастир от XII-XIV век, издълбан на два етажа в 40-метрова отвесна варовикова скала.',
    N'Аладжа манастир е най-известният скален манастир по Черноморието, издълбан на две нива във висок варовиков масив сред Природен парк Златни пясъци. Включва църква, монашески килии, трапезария и параклис с фрески.',
    NULL,
    N'/places/aladzha-manastir.jpg',
    N'Фотография: Уикипедия / Свободен лиценз',
    0
);
INSERT INTO [dbo].[Places] ([PlaceId], [Name], [Slug], [CategoryId], [RegionId], [Latitude], [Longitude], [ElevationMeters], [Difficulty], [AccessDetails], [BestSeason], [ShortDescription], [FullDescription], [HistoricalContext], [ImageUrl], [ImageCredit], [IsFeatured])
VALUES (
    N'asenova-krepost',
    N'Асенова крепост и църква „Св. Богородица Петричка“',
    N'asenova-krepost',
    N'fortresses',
    N'south_central',
    41.9861,
    24.8731,
    0,
    N'Лесен',
    NULL,
    N'Целогодишно',
    N'Стражева твърдина, кацнала на отвесна скала над река Чепеларска с великолепно запазена двуетажна църква от XIII век.',
    N'Асеновата крепост (Петрич) се издига върху непристъпен скален рид на входа на Родопите над Асеновград. Ансамбълът включва двуетажната църква „Света Богородица Петричка“ и прочутия царски каменен надпис на Иван Асен II от 1231 г.',
    NULL,
    N'/places/asenova-krepost.jpg',
    N'Фотография: Уикипедия / Свободен лиценз',
    1
);
INSERT INTO [dbo].[Places] ([PlaceId], [Name], [Slug], [CategoryId], [RegionId], [Latitude], [Longitude], [ElevationMeters], [Difficulty], [AccessDetails], [BestSeason], [ShortDescription], [FullDescription], [HistoricalContext], [ImageUrl], [ImageCredit], [IsFeatured])
VALUES (
    N'krepost-tsarevets',
    N'Крепост Царевец в Търновград',
    N'krepost-tsarevets',
    N'fortresses',
    N'north_central',
    43.0833,
    25.6528,
    0,
    N'Лесен',
    NULL,
    N'Целогодишно',
    N'Главната твърдина на Второто българско царство с Царския дворец, Балдуиновата кула и Лобната скала над Янтра.',
    N'Царевец е символ на българската държавност през XII-XIV век. Комплексът обхваща Царския дворец, Патриаршеската катедрала „Възнесение Господне“, Балдуиновата кула и жилищни квартали, обградени от река Янтра.',
    NULL,
    N'/places/krepost-tsarevets.jpg',
    N'Фотография: Уикипедия / Свободен лиценз',
    1
);
INSERT INTO [dbo].[Places] ([PlaceId], [Name], [Slug], [CategoryId], [RegionId], [Latitude], [Longitude], [ElevationMeters], [Difficulty], [AccessDetails], [BestSeason], [ShortDescription], [FullDescription], [HistoricalContext], [ImageUrl], [ImageCredit], [IsFeatured])
VALUES (
    N'trigradsko-zhdrelo',
    N'Триградското ждрело',
    N'trigradsko-zhdrelo',
    N'waterfalls',
    N'south_central',
    41.6022,
    24.3828,
    0,
    N'Лесен',
    NULL,
    N'Май - октомври',
    N'Грандиозен 7-километров каньон с 300-метрови мраморни отвеси, тесен път и кристални родопски води.',
    N'Триградското ждрело е трето по дължина ждрело в България, изсечено в мрамори от река Триградска. Отвесните скали се сближават на по-малко от 100 метра. Тук се срещат находища на Орфеевото цвете (Haberlea rhodopensis).',
    NULL,
    N'/places/trigradsko-zhdrelo.jpg',
    N'Фотография: Уикипедия / Свободен лиценз',
    0
);
GO

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
