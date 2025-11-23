<p align="center">
  <img src="media/logotype.png" alt="Namespacer Logo" width="90">
</p>

<p align="center">
  <a href="https://github.com/onurmicoogullari/namespacer/actions/workflows/ci.yml"><img src="https://github.com/onurmicoogullari/namespacer/actions/workflows/ci.yml/badge.svg" alt="CI status"></a>
  <a href="https://github.com/onurmicoogullari/namespacer/actions/workflows/cd.yml"><img src="https://github.com/onurmicoogullari/namespacer/actions/workflows/cd.yml/badge.svg" alt="CD status"></a>
</p>

# Namespacer

Namespacer is a Visual Studio Code extension that keeps C# files aligned with your solution layout. It analyzes `.csproj`, `.sln/.slnx`, and `Directory.Build.props` files to infer the correct namespace for your `.cs` files, then rewrites the file with clean spacing. No more mismatched namespaces after moving files or reorganizing folders.

# How it works

## Using the extension

1. Open a C# file in VS Code.
2. Press `Ctrl+Shift+P` / `Cmd+Shift+P` and run **Namespacer: Fix Namespace(s) in…** (this is the exact command palette label).
3. Choose a scope from the quick picker:
   - **File** – fix only the active file.
   - **Directory** – recursively sweep the active file’s folder.
   - **Project** – update every file under the owning `.csproj` (prompts once if multiple projects share a folder).
   - **Solution** – pick any `.sln` or `.slnx` in your workspace (multi-root supported) and rewrite all `.cs` files in every project it references.
4. Watch the progress notification; Namespacer reports how many files were updated, skipped, or failed.

## Under the hood

1. **Project/solution detection** – Namespacer walks up from each file to find the nearest `.csproj`. If a `.sln/.slnx` is encountered first, it stops (unless you explicitly selected the Solution scope, in which case it loads every project listed in that solution).
2. **Root namespace resolution** – Reads `<RootNamespace>` from the project or nearest `Directory.Build.props`, caching results for performance.
3. **Namespace calculation** – Appends sanitized folder names under the project root to the root namespace to build the final `namespace Contoso.Foo.Bar;`.
4. **Whitespace cleanup** – Deletes stray blank lines between `using`s and code so the file-scoped namespace lands correctly, then inserts the namespace with exactly one blank line separating sections.
5. **Safety checks** – Skips files containing only assembly attributes or global usings, and surfaces an error if no project can be determined.
6. **Namespace style** – New namespaces are emitted as file-scoped; if a file already uses block-scoped syntax, Namespacer preserves that style when updating it.

## Before/after

```
src/
  Proj1/
    Proj1.csproj  (<RootNamespace>MyCompany.Proj1</RootNamespace>)
    Services/
      UserService.cs
```

```csharp
// Before
using System;

public class UserService { }
```

```csharp
// After
using System;

namespace MyCompany.Proj1.Services;

public class UserService
{
}
```

# Installation

Namespacer can be installed directly from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=onurmicoogullari.namespacer) like any other extension. To run it from source instead:

```bash
git clone https://github.com/onurmicoogullari/namespacer.git
cd namespacer
pnpm install
pnpm run build
# Press F5 inside VS Code to launch the Extension Development Host
```

# Release

Namespacer uses [Changesets](https://github.com/changesets/changesets) for versioning. Each releasable change includes a `.changeset/*.md` entry. When the automated “Apply changesets” PR is merged:

1. `pnpm changeset tag` creates an annotated `vX.Y.Z` tag (and the workflow now pushes it upstream).
2. The CD workflow picks up the tag, pins `package.json` to that version, builds the extension, and publishes it via `vsce`.

# Feedback

Issues and discussions help shape the roadmap. If you find a bug, have a feature request, or need to discuss how Namespacer behaves in your repo, please [open an issue](https://github.com/onurmicoogullari/namespacer/issues).

# License

Namespacer is licensed under the [MIT License](LICENSE). Commercial and open-source use are both permitted.
