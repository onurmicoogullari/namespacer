<img src="media/logotype.png" alt="Namespacer Logo" width="90"/>  

[![CI](https://github.com/onurmicoogullari/namespacer/actions/workflows/ci.yml/badge.svg)](https://github.com/onurmicoogullari/namespacer/actions/workflows/ci.yml)  
[![CD](https://github.com/onurmicoogullari/namespacer/actions/workflows/cd.yml/badge.svg)](https://github.com/onurmicoogullari/namespacer/actions/workflows/cd.yml)  

# Namespacer
Effortlessly maintain file-scoped C# namespaces in VS Code: this extension analyzes your project and solution layout (including `.csproj` and `Directory.Build.props`) to insert or update namespaces so they always reflect your folder hierarchy and configured `RootNamespace`.


## ✨ Features

- 📂 Detects the closest `.csproj` file (or solution root) relative to the current C# file.  
- 🔍 Supports reading `<RootNamespace>` from:
  - the project’s `.csproj`
  - any `Directory.Build.props` up to the solution level  
- 📁 Builds namespaces by appending folder names under the project root.  
- 📜 Uses **file-scoped namespaces** (C# 10+ style).  
- 🛠 Multi-project workspaces & `.sln` boundaries respected.  
- 🔄 Replaces an existing `namespace` declaration cleanly if present.  
- 📄 **Empty** or **namespace-only** files get a fresh namespace at the top.  
- ⚡ Bulk-fix picker lets you update just the active file or sweep an entire directory, project, or solution (across multiple workspace folders) in one go.  
- 🧹 Ensures consistent spacing:
  - exactly one blank line between the last `using` and the `namespace` declaration  
  - exactly one blank line between the `namespace` declaration and the first type (`class`, `interface` or `enum`).  


## 📦 Installation

Install from the [Visual Studio Code Marketplace](https://marketplace.visualstudio.com/items?itemName=onurmicoogullari.namespacer) or run from source by following these steps:

1. Clone this repo.  
2. Run `pnpm install`.  
3. Run `pnpm run build`.  
4. Press **F5** inside VS Code to launch an Extension Development Host.


## ⚙️ Usage

1. Open any `.cs` file.  
2. Open the Command Palette (`Ctrl+Shift+P` on Windows or `CMD+Shift+P` on Mac).  
3. Run **Namespacer: Fix Namespace(s) in…** and choose whether to fix the active File, its Directory, the containing Project, or an entire Solution.
**What happens:**

- Locates the closest `.csproj` and `Directory.Build.props` (or solution root).  
- Reads `<RootNamespace>` (or falls back to project name).  
- Calculates the full namespace by appending folders.  
- Deletes any blank lines between the `using` block and your code.  
- Inserts or replaces a file-scoped `namespace Foo.Bar;` with tidy spacing, even in multi-root workspaces where solution files may live in different folders.


## 🛠 Commands

| Command                        | Description                                                                                  |
|:-------------------------------|:---------------------------------------------------------------------------------------------|
| `namespacer.fixNamespaces`     | Opens a picker so you can fix the active File, its Directory, the containing Project, or a Solution. |


## 🧠 How it Works

1. **Find project context**  
   - Walks upward from the current file.  
   - Stops at the first `.csproj`, then checks `Directory.Build.props` up to the solution root.  
   - If multiple projects exist in one folder, prompts you to choose.

2. **Calculate root namespace**  
   - Reads `<RootNamespace>` (or defaults to the `.csproj` filename).  
   - Appends any folder segments under the project root.

3. **Clean whitespace**  
   - Deletes all blank lines between the last `using` and the first non-using code.  
   - Enforces exactly one blank line before *and* after the `namespace` declaration.  
   - Special-cases empty or namespace-only files.

4. **Insert namespace**  
   - Leaves **one** blank line above the new namespace (if `using`s exist).  
   - Emits `namespace Foo.Bar;` as a file-scoped namespace.  
   - Leaves **one** blank line between the namespace declaration and the first type.

## 📝 Examples

### Example 1: With RootNamespace

```
src/
  Proj1/
    Proj1.csproj      (RootNamespace: MyCompany.Proj1)
    Services/
      UserService.cs
```

**Before:**
```csharp
using System;

…lots of blank lines…
public class UserService { }
```

**After “Fix Namespaces…” (File scope):**
```csharp
using System;

namespace MyCompany.Proj1.Services;

public class UserService
{
    // …
}
```

### Example 2: Without RootNamespace

```
src/
  Proj2/
    Proj2.csproj      (no `<RootNamespace>` set)
    Controllers/
      HomeController.cs
```

**After:**
```csharp
using System;

namespace Proj2.Controllers;

public class HomeController
{
    // …
}
```

### Example 3: Empty or Namespace-Only File

- **Empty file** → becomes:
  ```csharp
  namespace MyCompany.MyProj;
  ```
- **Only namespace present** → gets replaced with the correct one.  


## 📄 License

This project is licensed under the [GPL-3.0-or-later](LICENSE).


## 💬 Contributing

PRs and issues are welcome.

## 🚀 Releases & Versioning

- Run `pnpm exec changeset` (or `pnpm dlx changeset`) whenever you make a change that should ship. Describe the change and choose its semver bump.
- The **Changesets** workflow opens/updates an “Apply changesets” PR that bumps `package.json`, updates release notes, and keeps `main`’s version in sync with the next release.
- When that PR is merged, the workflow runs `pnpm changeset tag`, pushes the resulting `v1.2.3` tag to GitHub, and keeps `main` aligned with the release.
- The **CD** workflow listens to those tags, forces the extension version in `package.json` to match the tag, builds, and publishes it via `vsce` (using the `VSCE_PAT` secret).
- Configure the `CHANGESETS_PAT` GitHub secret with a token that can create branches/PRs and push tags so the release automation can operate end-to-end.
