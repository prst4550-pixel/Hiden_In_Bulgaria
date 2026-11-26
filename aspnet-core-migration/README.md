# ASP.NET Core MVC файлове за „Скрито в България“

В тази папка са отделени модели, контекст и контролери на C#, в случай че проектът трябва да се пренесе в .NET / ASP.NET Core MVC с SQLite база.

Основното работещо приложение (React + Express) е в главната директория на проекта — вижте [`../README.md`](../README.md).

## Какво съдържа папката

- Модели: `Place.cs`, `Category.cs`, `Region.cs`, `Route.cs`, `CommunitySuggestion.cs`, `Review.cs`
- База данни (EF Core): `ApplicationDbContext.cs`
- Контролери: `PlacesController.cs`, `AccountController.cs`

## Как да се използва в нов .NET проект

```bash
dotnet new mvc -n HiddenBulgaria
cd HiddenBulgaria
dotnet add package Microsoft.EntityFrameworkCore.Sqlite
dotnet add package Microsoft.EntityFrameworkCore.Design
```

Копирайте файловете от тук в съответните папки `Models/`, `Data/`, `Controllers/` и `Views/` и регистрирайте `ApplicationDbContext` в `Program.cs`:

```csharp
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")
        ?? "Data Source=hidden_bulgaria.db"));
```

Направете миграцията и пуснете сървъра:

```bash
dotnet ef migrations add InitialCreate
dotnet ef database update
dotnet run
```
