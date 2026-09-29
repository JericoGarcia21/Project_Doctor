# Project Doctor - Testing Checklist

Use this checklist to verify everything works correctly.

---

## ✅ Pre-Launch Checks

- [ ] Dependencies installed (`npm install`)
- [ ] Code compiled successfully (`npm run compile`)
- [ ] No TypeScript errors
- [ ] Tests pass (`npm test` - 20/20 passing)

---

## ✅ Extension Launch

- [ ] Press F5 in VS Code
- [ ] Extension Development Host opens
- [ ] No errors in Debug Console
- [ ] Open a folder in Extension Development Host

---

## ✅ Extension Activation

- [ ] Extension activates automatically when folder opens
- [ ] Check Output panel (View → Output → "Project Doctor")
- [ ] Should see: "Project Doctor activated for workspace..."
- [ ] No error messages appear

---

## ✅ Command: Scan Project

### Basic Test
- [ ] Open Command Palette (`Ctrl+Shift+P`)
- [ ] Type "Project Doctor: Scan"
- [ ] Command appears in list
- [ ] Press Enter
- [ ] Scan notification appears
- [ ] Scan completes (notification)
- [ ] Output shows scan results

### Verify Output Contains:
```
[ProjectScanner] Starting scan of: ...
[dependency-analyzer] Starting dependency analysis...
[file-analyzer] Starting file analysis...
[security-analyzer] Starting security analysis...
Scan completed in XXXms
Files scanned: XX
Technologies detected: ...
Results saved to database
```

- [ ] All log lines appear
- [ ] Scan duration is reasonable (<5 seconds for small project)
- [ ] File count is correct
- [ ] Technologies detected correctly

---

## ✅ Command: Open Dashboard

### Open Dashboard
- [ ] Open Command Palette (`Ctrl+Shift+P`)
- [ ] Type "Project Doctor: Open Dashboard"
- [ ] Command appears
- [ ] Press Enter
- [ ] Dashboard tab opens

### Dashboard UI Elements
- [ ] Header displays: "PROJECT DOCTOR"
- [ ] Project name shows correctly
- [ ] Statistics cards visible:
  - [ ] Files count (number displayed)
  - [ ] Problems count (number displayed)
  - [ ] Warnings count (number displayed)

### Technology Badges
- [ ] "Technologies" section visible
- [ ] Badges appear for detected technologies
- [ ] Colors are visible (badges have background)

### Scan Button
- [ ] "Scan Project" or "Scan Project Again" button visible
- [ ] Button is clickable
- [ ] Clicking triggers new scan
- [ ] Dashboard updates after scan

### Findings Display (if any)
- [ ] "Findings" section appears (if issues found)
- [ ] Finding cards display:
  - [ ] Title
  - [ ] Description
  - [ ] File path
  - [ ] Category
  - [ ] Severity
- [ ] Color coding works (warning = orange, error = red)

---

## ✅ Technology Detection Tests

### Test 1: Current Project (Project_Doctor)
Open the Project_Doctor folder itself:

- [ ] Detects: Node.js
- [ ] Detects: TypeScript
- [ ] Shows config files:
  - [ ] package.json
  - [ ] tsconfig.json
  - [ ] .gitignore

### Test 2: Create Test Project (Optional)
Create a simple test project:

```bash
mkdir test-project
cd test-project
npm init -y
echo "console.log('test')" > index.js
```

- [ ] Detects: Node.js
- [ ] Detects: package.json
- [ ] Scan completes

---

## ✅ Analyzer Tests

### Dependency Analyzer
Test with project that has package.json:
- [ ] No errors if dependencies exist
- [ ] Info message if no dependencies

### File Analyzer
Test with large file (optional):
```bash
# Create a 6MB file to trigger warning
dd if=/dev/zero of=largefile.txt bs=1M count=6
```
- [ ] Warning appears for files > 5MB
- [ ] Suggestion provided

### Security Analyzer
Test with .env file:
```bash
echo "SECRET_KEY=test123" > .env
```
- [ ] Warning appears about .env file
- [ ] Suggests adding to .gitignore

### Import Analyzer
- [ ] No errors (placeholder implementation)
- [ ] Completes successfully

---

## ✅ Database Persistence

### First Scan
- [ ] Run scan on a project
- [ ] Note the statistics
- [ ] Close dashboard

### Reopen Dashboard
- [ ] Run "Open Dashboard" again
- [ ] Statistics are still there
- [ ] Data persisted correctly

### Second Scan
- [ ] Run scan again
- [ ] New scan ID in database
- [ ] Updated timestamp
- [ ] Latest scan shows in dashboard

---

## ✅ Error Handling

### No Workspace Open
- [ ] Close all folders in Extension Development Host
- [ ] Try to run "Scan Project"
- [ ] Should show: "No workspace is currently open"
- [ ] Try to open dashboard
- [ ] Should show: "No workspace is currently open"

### Empty Folder
- [ ] Create and open empty folder
- [ ] Run scan
- [ ] Should complete without errors
- [ ] Statistics show 0 files

---

## ✅ Performance Tests

### Small Project (<100 files)
- [ ] Scan completes in < 2 seconds
- [ ] No lag in UI
- [ ] Dashboard loads instantly

### Medium Project (100-1000 files)
- [ ] Scan completes in < 5 seconds
- [ ] Progress visible
- [ ] No crashes

---

## ✅ UI/UX Tests

### Dashboard Visual Check
- [ ] Colors match VS Code theme
- [ ] Text is readable
- [ ] Buttons have hover effects
- [ ] Cards have proper spacing
- [ ] No overlapping elements
- [ ] Mobile-friendly (responsive)

### Dashboard Interactions
- [ ] Clicking scan button works
- [ ] Can scroll if many findings
- [ ] Technology badges don't overflow
- [ ] Statistics update after rescan

---

## ✅ Debug Console Check

In original VS Code window (not Extension Development Host):

### No Errors
- [ ] Open Debug Console (View → Debug Console)
- [ ] No red error messages
- [ ] Only info logs visible

### Expected Logs
Should see:
```
[Project Doctor] Extension is now active
[ProjectScanner] Starting scan...
[Database] Migrations complete
```

- [ ] All expected logs present
- [ ] No warnings about missing modules
- [ ] No database errors

---

## ✅ Activity Bar (Optional)

Check if Project Doctor appears in sidebar:
- [ ] Look for Project Doctor icon in Activity Bar (left side)
- [ ] Click it to open sidebar view
- [ ] "Project Health" view appears

---

## ✅ Cross-Project Testing

### Test Different Project Types

1. **JavaScript Project**
   - [ ] Detects: Node.js, JavaScript
   - [ ] Scans successfully

2. **TypeScript Project**
   - [ ] Detects: Node.js, TypeScript
   - [ ] Finds tsconfig.json

3. **React Project** (if available)
   - [ ] Detects: Node.js, TypeScript/JavaScript
   - [ ] Scans node_modules efficiently (ignored)

4. **PHP Project** (if available)
   - [ ] Detects: PHP
   - [ ] Detects: Laravel (if artisan present)

---

## ✅ Reload Tests

### Hot Reload
- [ ] Make code change in `src/`
- [ ] Run `npm run compile`
- [ ] Press `Ctrl+R` in Extension Development Host
- [ ] Extension reloads
- [ ] Changes take effect

### Full Restart
- [ ] Close Extension Development Host
- [ ] Press F5 again
- [ ] Extension launches fresh
- [ ] No cached issues

---

## 🐛 Known Issues to Check

### Issue: Module Not Found
- [ ] If see "Cannot find module" error
- [ ] Run: `npm install`
- [ ] Run: `npm run compile`
- [ ] Restart extension

### Issue: Dashboard Blank
- [ ] Open Developer Tools (`Ctrl+Shift+I`)
- [ ] Check Console for errors
- [ ] Verify database initialized

### Issue: Slow Scans
- [ ] Check project size (node_modules included?)
- [ ] Verify ignored directories working
- [ ] Check Debug Console for bottlenecks

---

## 📊 Expected Test Results

After completing this checklist, you should have:

✅ **20/20 tests passing**  
✅ **Extension activates without errors**  
✅ **Both commands working**  
✅ **Dashboard displays correctly**  
✅ **Technology detection working**  
✅ **Database persistence working**  
✅ **Scans complete in reasonable time**  
✅ **No console errors**  

---

## 📝 Test Results Template

Copy and fill out:

```
## Test Session: [Date]

### Environment
- VS Code Version: ______
- Node Version: ______
- OS: ______

### Results
- [ ] All pre-launch checks passed
- [ ] Extension activated successfully
- [ ] Scan Project command works
- [ ] Open Dashboard command works
- [ ] Dashboard UI displays correctly
- [ ] Technology detection accurate
- [ ] Database persistence works
- [ ] No errors in console

### Issues Found
1. ______________________
2. ______________________

### Notes
______________________
______________________
```

---

## 🎯 Quick Validation (30 seconds)

Minimal test to verify extension works:

1. ✅ Press F5
2. ✅ Open any folder
3. ✅ Run "Scan Project"
4. ✅ Run "Open Dashboard"
5. ✅ See statistics displayed

**If all 5 steps work → Extension is functional! ✅**

---

**Last Updated**: 2026-09-29
