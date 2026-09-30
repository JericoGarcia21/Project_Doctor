import { describe, it, expect } from 'vitest';
import { PHPParser } from '../../src/parsers/PHPParser';

describe('PHPParser', () => {
  const parser = new PHPParser();

  describe('Laravel Middleware Parsing', () => {
    it('should detect middleware on routes', () => {
      const code = `<?php
use Illuminate\Support\Facades\Route;

Route::get('/users', [UserController::class, 'index'])->middleware('auth');
Route::post('/users', [UserController::class, 'store'])->middleware('auth', 'throttle:60,1');
`;
      const result = parser.parseLaravelMiddleware(code, 'routes/web.php');

      expect(result).toHaveLength(2);
      expect(result[0].middleware).toContain('auth');
      expect(result[1].middleware).toContain('auth');
      expect(result[1].middleware).toContain('throttle:60,1');
    });

    it('should detect middleware in route groups', () => {
      const code = `<?php
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'index']);
    Route::get('/profile', [ProfileController::class, 'show']);
});
`;
      const result = parser.parseLaravelMiddleware(code, 'routes/web.php');

      expect(result).toHaveLength(2);
      expect(result[0].middleware).toContain('auth');
      expect(result[0].middleware).toContain('verified');
      expect(result[1].middleware).toContain('auth');
      expect(result[1].middleware).toContain('verified');
    });

    it('should detect routes without middleware', () => {
      const code = `<?php
use Illuminate\Support\Facades\Route;

Route::get('/public', [PublicController::class, 'index']);
`;
      const result = parser.parseLaravelMiddleware(code, 'routes/web.php');

      expect(result).toHaveLength(1);
      expect(result[0].middleware).toHaveLength(0);
    });

    it('should handle nested route groups with middleware', () => {
      const code = `<?php
use Illuminate\Support\Facades\Route;

Route::middleware('auth')->group(function () {
    Route::middleware('admin')->group(function () {
        Route::get('/admin/users', [AdminController::class, 'users']);
    });
});
`;
      const result = parser.parseLaravelMiddleware(code, 'routes/web.php');

      expect(result).toHaveLength(1);
      expect(result[0].middleware).toContain('auth');
      expect(result[0].middleware).toContain('admin');
    });

    it('should combine group and route middleware', () => {
      const code = `<?php
use Illuminate\Support\Facades\Route;

Route::middleware('auth')->group(function () {
    Route::get('/posts', [PostController::class, 'index'])->middleware('throttle:30,1');
});
`;
      const result = parser.parseLaravelMiddleware(code, 'routes/web.php');

      expect(result).toHaveLength(1);
      expect(result[0].middleware).toContain('auth');
      expect(result[0].middleware).toContain('throttle:30,1');
    });
  });

  describe('Eloquent Model Parsing', () => {
    it('should detect Eloquent models', () => {
      const code = `<?php
namespace App\\Models;

use Illuminate\\Database\\Eloquent\\Model;

class User extends Model
{
    protected $table = 'users';
}
`;
      const result = parser.parseEloquentModels(code, 'app/Models/User.php');

      expect(result).toHaveLength(1);
      expect(result[0].className).toBe('User');
      expect(result[0].namespace).toBe('App\\Models');
      expect(result[0].tableName).toBe('users');
    });

    it('should extract fillable properties', () => {
      const code = `<?php
namespace App\\Models;

use Illuminate\\Database\\Eloquent\\Model;

class Post extends Model
{
    protected $fillable = ['title', 'body', 'published_at'];
}
`;
      const result = parser.parseEloquentModels(code, 'app/Models/Post.php');

      expect(result).toHaveLength(1);
      expect(result[0].fillable).toContain('title');
      expect(result[0].fillable).toContain('body');
      expect(result[0].fillable).toContain('published_at');
    });

    it('should extract hidden properties', () => {
      const code = `<?php
namespace App\\Models;

use Illuminate\\Database\\Eloquent\\Model;

class User extends Model
{
    protected $hidden = ['password', 'remember_token'];
}
`;
      const result = parser.parseEloquentModels(code, 'app/Models/User.php');

      expect(result).toHaveLength(1);
      expect(result[0].hidden).toContain('password');
      expect(result[0].hidden).toContain('remember_token');
    });

    it('should extract casts', () => {
      const code = `<?php
namespace App\\Models;

use Illuminate\\Database\\Eloquent\\Model;

class Post extends Model
{
    protected $casts = [
        'published_at' => 'datetime',
        'is_featured' => 'boolean',
        'metadata' => 'array',
    ];
}
`;
      const result = parser.parseEloquentModels(code, 'app/Models/Post.php');

      expect(result).toHaveLength(1);
      expect(result[0].casts['published_at']).toBe('datetime');
      expect(result[0].casts['is_featured']).toBe('boolean');
      expect(result[0].casts['metadata']).toBe('array');
    });

    it('should extract hasMany relationships', () => {
      const code = `<?php
namespace App\\Models;

use Illuminate\\Database\\Eloquent\\Model;

class User extends Model
{
    public function posts()
    {
        return $this->hasMany(Post::class);
    }
}
`;
      const result = parser.parseEloquentModels(code, 'app/Models/User.php');

      expect(result).toHaveLength(1);
      expect(result[0].relationships).toHaveLength(1);
      expect(result[0].relationships[0].type).toBe('hasMany');
      expect(result[0].relationships[0].method).toBe('posts');
      expect(result[0].relationships[0].relatedModel).toBe('Post');
    });

    it('should extract belongsTo relationships', () => {
      const code = `<?php
namespace App\\Models;

use Illuminate\\Database\\Eloquent\\Model;

class Post extends Model
{
    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
`;
      const result = parser.parseEloquentModels(code, 'app/Models/Post.php');

      expect(result).toHaveLength(1);
      expect(result[0].relationships).toHaveLength(1);
      expect(result[0].relationships[0].type).toBe('belongsTo');
      expect(result[0].relationships[0].method).toBe('user');
      expect(result[0].relationships[0].relatedModel).toBe('User');
    });

    it('should extract belongsToMany relationships with pivot table', () => {
      const code = `<?php
namespace App\\Models;

use Illuminate\\Database\\Eloquent\\Model;

class User extends Model
{
    public function roles()
    {
        return $this->belongsToMany(Role::class, 'role_user');
    }
}
`;
      const result = parser.parseEloquentModels(code, 'app/Models/User.php');

      expect(result).toHaveLength(1);
      expect(result[0].relationships).toHaveLength(1);
      expect(result[0].relationships[0].type).toBe('belongsToMany');
      expect(result[0].relationships[0].method).toBe('roles');
      expect(result[0].relationships[0].relatedModel).toBe('Role');
      expect(result[0].relationships[0].pivotTable).toBe('role_user');
    });

    it('should extract relationships with custom foreign keys', () => {
      const code = `<?php
namespace App\\Models;

use Illuminate\\Database\\Eloquent\\Model;

class Post extends Model
{
    public function user()
    {
        return $this->belongsTo(User::class, 'author_id');
    }
}
`;
      const result = parser.parseEloquentModels(code, 'app/Models/Post.php');

      expect(result).toHaveLength(1);
      expect(result[0].relationships).toHaveLength(1);
      expect(result[0].relationships[0].type).toBe('belongsTo');
      expect(result[0].relationships[0].foreignKey).toBe('author_id');
    });

    it('should extract multiple relationships from one model', () => {
      const code = `<?php
namespace App\\Models;

use Illuminate\\Database\\Eloquent\\Model;

class User extends Model
{
    public function posts()
    {
        return $this->hasMany(Post::class);
    }

    public function comments()
    {
        return $this->hasMany(Comment::class);
    }

    public function role()
    {
        return $this->belongsTo(Role::class);
    }
}
`;
      const result = parser.parseEloquentModels(code, 'app/Models/User.php');

      expect(result).toHaveLength(1);
      expect(result[0].relationships).toHaveLength(3);
      expect(result[0].relationships[0].type).toBe('hasMany');
      expect(result[0].relationships[1].type).toBe('hasMany');
      expect(result[0].relationships[2].type).toBe('belongsTo');
    });

    it('should detect Authenticatable models', () => {
      const code = `<?php
namespace App\\Models;

use Illuminate\\Foundation\\Auth\\User as Authenticatable;

class Admin extends Authenticatable
{
    protected $table = 'admins';
}
`;
      const result = parser.parseEloquentModels(code, 'app/Models/Admin.php');

      expect(result).toHaveLength(1);
      expect(result[0].className).toBe('Admin');
      expect(result[0].tableName).toBe('admins');
    });

    it('should return empty array for non-Eloquent classes', () => {
      const code = `<?php
namespace App\\Services;

class PaymentService
{
    public function process()
    {
        return true;
    }
}
`;
      const result = parser.parseEloquentModels(code, 'app/Services/PaymentService.php');

      expect(result).toHaveLength(0);
    });

    it('should handle models without explicit table name', () => {
      const code = `<?php
namespace App\\Models;

use Illuminate\\Database\\Eloquent\\Model;

class BlogPost extends Model
{
    protected $fillable = ['title', 'content'];
}
`;
      const result = parser.parseEloquentModels(code, 'app/Models/BlogPost.php');

      expect(result).toHaveLength(1);
      expect(result[0].className).toBe('BlogPost');
      expect(result[0].tableName).toBeUndefined();
    });
  });
});
