# Project Doctor UI

## Design Direction

Project Doctor is a focused developer tool. Its interface should be quiet, readable, and consistent with the active VS Code theme. Avoid decorative icons, emoji, gradients, animations, and marketing-style branding.

Use text labels for actions and severity. Use spacing, typography, dividers, and VS Code theme colors to establish hierarchy.

## Sidebar

The sidebar presents:

- Workspace name and last scan time
- File, error, and warning totals
- Detected technologies
- A short list of findings with severity, title, description, and file location
- A scan action and clear empty/error states

Keep the layout compact for narrow view columns. Findings that open a file must be keyboard accessible and visibly focused. Keep non-actionable rows visually distinct from clickable rows.

## Editor Dashboard

The editor dashboard uses the same typography, labels, theme colors, and finding presentation as the sidebar, with more room for the full result list. Organize content into unframed sections. Use simple dividers instead of nested cards or decorative surfaces.

## Visual Language

- Use VS Code variables for foreground, background, borders, buttons, focus, and severity colors.
- Keep text sizes modest and consistent with the editor.
- Use zero letter spacing.
- Keep technology labels and severity labels plain and scannable.
- Avoid layout shifts on hover and keep long paths and project names readable.

## Accessibility

- Use semantic headings, sections, buttons, and labels.
- Support keyboard activation for clickable findings.
- Provide a visible focus outline using the VS Code focus color.
- Do not rely on color alone to communicate severity; show its text label.
- Escape project and scan data before rendering it in webview markup.

## Responsive Behavior

- Let sidebar content wrap within narrow widths.
- Keep summary values stable and readable as the editor width changes.
- Allow technology labels and finding metadata to wrap without overlap.
- Respect the user's active VS Code theme, including high-contrast themes.

## Manual Review

- Check empty, error, zero-finding, and populated states.
- Check long workspace names, long file paths, and many findings.
- Verify scan actions and finding navigation with mouse and keyboard.
- Review in dark, light, and high-contrast VS Code themes.