# Project Doctor - Quick Start Guide

## 🚀 How to Run and Test the Extension

### Prerequisites

Make sure you have:
- ✅ Node.js installed (v18 or higher)
- ✅ VS Code installed
- ✅ The project open in VS Code

---

## Step 1: Install Dependencies

Open a terminal in the project root and run:

```bash
npm install
```

This will install all required dependencies (should already be done).

---

## Step 2: Compile the Extension

Compile TypeScript to JavaScript:

```bash
npm run compile
```

You should see output like:
```
> project-doctor@0.1.0 compile
> tsc -p ./
```

✅ If no errors appear, compilation succeeded!

---

## Step 3: Launch the Extension

There are two ways to run the extension:

### Method A: Press F5 (Recommended)

1. Make sure you're in VS Code
2. Press **F5** on your keyboard
3. A new VS Code window will open (called "Extension Development Host")
4. This new window has your extension running!

### Method B: Use Debug Menu

1. Click the **Run and Debug** icon in the sidebar (or press `Ctrl+Shift+D`)
2. Select **"Run Extension"** from the dropdown at the top
3. Click the green play button ▶️
4. A new VS Code window will open

---

## Step 4: Open a Test Project

In the **Extension Development Host** window:

1. Click **File → Open Folder**
2. Choose **any project folder** on your computer (the Project_Doctor folder itself works great for testing!)
3. The extension will activate automatically

---

## Step 5: Test the Commands

### Test Command 1: Scan Project

1. Open the Command Palette:
   - **Windows/Linux**: `Ctrl+Shift+P`
   - **Mac**: `Cmd+Shift+P`

2. Type: **Project Doctor: Scan Project**

3. Press Enter

4. You should see:
   - ✅ A notification with scan progress
   - ✅ Output in the "Project Doctor" output channel
   - ✅ A notification when scan completes

### Test Command 2: Open Dashboard

1. Open Command Palette again (`Ctrl+Shift+P`)

2. Type: **Project Doctor: Open Dashboard**

3. Press Enter

4. You should see:
   - ✅ A new tab opens with the dashboard
   - ✅ Project statistics displayed
   - ✅ Technology badges (Node.js, TypeScript, etc.)
   - ✅ Any findings from the scan

---

## Step 6: View the Output

### Check the Output Channel

1. In the Extension Development Host window
2. Click **View → Output** (or press `Ctrl+Shift+U`)
3. In the dropdown, select **"Project Doctor"**
4. You'll see logs like:

```
[Project Doctor] Extension is now active
Project Doctor activated for workspace: C:\Users\...\Project_Doctor
Run "Project Doctor: Scan Project" to analyze your project
[ProjectScanner] Starting scan of: C:\Users\...\Project_Doctor
[dependency-analyzer] Starting dependency analysis...
[security-analyzer] Starting security analysis...
Scan completed in 1234ms
Files scanned: 50
Technologies detected: Node.js, TypeScript
```

---

## Step 7: Test the Dashboard Features

### What to Check:

1. **Statistics Cards**
   - Files count
   - Problems count
   - Warnings count

2. **Technology Badges**
   - Should show detected technologies (Node.js, TypeScript, etc.)

3. **Scan Button**
   - Click "Scan Project" or "Scan Project Again"
   - Should trigger a new scan

4. **Findings Section**
   - If any issues were found, they'll appear here
   - Each finding shows:
     - Title
     - Description
     - File path
     - Category
     - Severity (color-coded)

---

## Step 8: Test with Different Projects

Try scanning different types of projects:

### Test with a React Project
1. Open a React project in the Extension Development Host
2. Run scan - should detect: Node.js, TypeScript/JavaScript, React

### Test with a Laravel Project
1. Open a Laravel/PHP project
2. Run scan - should detect: PHP, Laravel, Composer

### Test with Current Project (Project_Doctor)
1. Open the Project_Doctor folder itself
2. Run scan - should detect: Node.js, TypeScript, Vite

---

## 🐛 Debugging Tips

### If Extension Doesn't Activate:

1. Check the Debug Console in the original VS Code window
2. Look for errors in red
3. Make sure compilation succeeded (`npm run compile`)

### If Commands Don't Appear:

1. Close the Extension Development Host
2. Run `npm run compile` again
3. Press F5 to relaunch

### If Dashboard is Blank:

1. Open Developer Tools in Extension Development Host:
   - Press `Ctrl+Shift+I` (Windows/Linux)
   - Press `Cmd+Option+I` (Mac)
2. Check the Console tab for errors
3. Look in the original VS Code Debug Console

### To See Real-Time Logs:

1. In the **original VS Code window** (not Extension Development Host)
2. Open the **Debug Console** (View → Debug Console)
3. You'll see all console.log() output

---

## 🧪 Running Tests

To run the unit tests:

```bash
npm test
```

Expected output:
```
✓ tests/diagnostics/FindingManager.test.ts (6)
✓ tests/core/ScanResult.test.ts (3)
✓ tests/graph/ProjectGraph.test.ts (5)
✓ tests/core/ProjectContext.test.ts (6)

Test Files  4 passed (4)
     Tests  20 passed (20)
```

---

## 📝 Making Changes

### To Modify Code:

1. Edit any file in `src/`
2. Run `npm run compile` to rebuild
3. Press `Ctrl+R` in Extension Development Host to reload
   - Or restart by pressing F5 again

### Auto-Compile (Watch Mode):

Instead of manually compiling each time:

```bash
npm run watch
```

This will automatically recompile when you save files!

---

## 🎯 What to Test

### Basic Functionality Checklist:

- [ ] Extension activates when opening a folder
- [ ] "Scan Project" command appears in Command Palette
- [ ] "Open Dashboard" command appears in Command Palette
- [ ] Scan completes without errors
- [ ] Dashboard opens and displays data
- [ ] Technology detection works
- [ ] Findings are displayed
- [ ] Can click "Scan Project" button in dashboard
- [ ] Output channel shows logs

### Advanced Testing:

- [ ] Test with empty folder
- [ ] Test with large project (1000+ files)
- [ ] Test with project that has .env file (security warning)
- [ ] Test with project that has large files (file size warning)
- [ ] Close and reopen dashboard - data persists
- [ ] Scan multiple times - history is saved

---

## 📊 Expected Results

### For Project_Doctor Folder:

When scanning the Project_Doctor folder itself, you should see:

**Technologies Detected:**
- Node.js
- TypeScript
- Vite (if vite.config.ts exists)

**Statistics:**
- Files: ~50-60
- Problems: 0-2
- Warnings: 0-1

**Possible Findings:**
- Warning: Environment File Detected (.env if exists)
- Warning: Large File Detected (if any files > 5MB)

---

## 🆘 Common Issues

### Issue: "Cannot find module 'sql.js'"

**Solution:**
```bash
npm install
npm run compile
```

### Issue: Extension doesn't appear in Extension Development Host

**Solution:**
1. Check `package.json` - make sure all paths are correct
2. Try: `Ctrl+Shift+P` → "Developer: Reload Window"

### Issue: Dashboard shows "Ready to scan" but no button works

**Solution:**
1. Open Developer Tools (`Ctrl+Shift+I`)
2. Check Console for JavaScript errors
3. Make sure database initialized properly

### Issue: Compilation errors

**Solution:**
```bash
# Clean rebuild
rm -rf dist node_modules
npm install
npm run compile
```

---

## 🎉 Success!

If you see:
- ✅ Extension activates
- ✅ Scan completes
- ✅ Dashboard displays
- ✅ Technologies detected
- ✅ No errors in console

**Congratulations! Project Doctor is running successfully!** 🎊

---

## 📚 Next Steps

1. **Explore the Code**
   - Check `src/extension.ts` - extension entry point
   - Look at `src/core/ProjectScanner.ts` - main scanning logic
   - Review `src/commands/` - command implementations

2. **Try Modifications**
   - Add a new analyzer
   - Modify the dashboard UI
   - Add new technology detection

3. **Read Documentation**
   - `README.md` - Complete overview
   - `ROADMAP.md` - Future plans
   - `SETUP_COMPLETE.md` - What was built

---

## 💡 Pro Tips

1. **Keep Watch Mode Running**
   ```bash
   npm run watch
   ```
   Then just reload Extension Development Host with `Ctrl+R`

2. **Use Debug Breakpoints**
   - Set breakpoints in your code
   - They'll trigger when extension runs
   - Step through code execution

3. **Check Multiple Projects**
   - Test with various project types
   - See how detection adapts

4. **Monitor Performance**
   - Check scan duration in output
   - Large projects should scan in <5 seconds

---

**Need Help?** Check the Debug Console in VS Code for detailed error messages!
