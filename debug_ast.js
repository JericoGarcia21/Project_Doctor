const { Engine } = require('php-parser');

const engine = new Engine({
  parser: { version: '8.2', suppressErrors: false },
  ast: { withPositions: true }
});

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

const ast = engine.parseCode(code, 'test.php');

// Navigate to the method node
const classNode = ast.children[0].children[1];
const methodNode = classNode.body[0];

// Check the method body structure
console.log("Method body kind:", methodNode.body.kind);
console.log("Method body children:", methodNode.body.children?.length);

if (methodNode.body.children) {
  for (const child of methodNode.body.children) {
    console.log("Child kind:", child.kind);
    if (child.kind === 'return') {
      console.log("Return expr kind:", child.expr?.kind);
      if (child.expr?.kind === 'call') {
        console.log("Call what kind:", child.expr.what?.kind);
        if (child.expr.what?.kind === 'propertylookup') {
          console.log("Propertylookup offset:", child.expr.what.offset?.name);
        }
      }
    }
  }
}
