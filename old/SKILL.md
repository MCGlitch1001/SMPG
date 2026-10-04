---
name: unified-skills
description: A comprehensive toolkit combining Brand Guidelines, Canvas Design, Frontend Design, Skill Creation, and Web Application Testing capabilities. Use this master skill for tasks involving: (1) Applying Anthropic's brand identity, (2) Creating artistic visual designs, (3) Building distinctive frontend interfaces, (4) Creating new agent skills, or (5) Testing web applications with Playwright.
license: See individual LICENSE.txt files in subdirectories
---

# Unified Agent Skills

This document consolidates five specialized skill sets into a single operational guide.

## Table of Contents
1. [Brand Guidelines](#brand-guidelines) - Official Anthropic branding
2. [Canvas Design](#canvas-design) - High-quality visual art creation
3. [Frontend Design](#frontend-design) - Distinctive web interface design
4. [Skill Creator](#skill-creator) - Guide for creating new skills
5. [Web Application Testing](#web-application-testing) - Local testing with Playwright

---

# Brand Guidelines
*Located in: `skill-assets/brand-guidelines/`*

## Overview

To access Anthropic's official brand identity and style resources, use this section.

**Keywords**: branding, corporate identity, visual identity, post-processing, styling, brand colors, typography, Anthropic brand, visual formatting, visual design

## Brand Guidelines

### Colors

**Main Colors:**

- Dark: `#141413` - Primary text and dark backgrounds
- Light: `#faf9f5` - Light backgrounds and text on dark
- Mid Gray: `#b0aea5` - Secondary elements
- Light Gray: `#e8e6dc` - Subtle backgrounds

**Accent Colors:**

- Orange: `#d97757` - Primary accent
- Blue: `#6a9bcc` - Secondary accent
- Green: `#788c5d` - Tertiary accent

### Typography

- **Headings**: Poppins (with Arial fallback)
- **Body Text**: Lora (with Georgia fallback)
- **Note**: Fonts should be pre-installed in your environment for best results

## Features

### Smart Font Application

- Applies Poppins font to headings (24pt and larger)
- Applies Lora font to body text
- Automatically falls back to Arial/Georgia if custom fonts unavailable
- Preserves readability across all systems

### Text Styling

- Headings (24pt+): Poppins font
- Body text: Lora font
- Smart color selection based on background
- Preserves text hierarchy and formatting

### Shape and Accent Colors

- Non-text shapes use accent colors
- Cycles through orange, blue, and green accents
- Maintains visual interest while staying on-brand

## Technical Details

### Font Management

- Uses system-installed Poppins and Lora fonts when available
- Provides automatic fallback to Arial (headings) and Georgia (body)
- No font installation required - works with existing system fonts
- For best results, pre-install Poppins and Lora fonts in your environment

### Color Application

- Uses RGB color values for precise brand matching
- Applied via python-pptx's RGBColor class
- Maintains color fidelity across different systems

---

# Canvas Design
*Located in: `skill-assets/canvas-design/`*

Detailed instructions for creating design philosophies and expressing them visually.

## Process Overview
1. **Design Philosophy Creation** (.md file)
2. **Express Visually** on canvas (.pdf or .png file)

## DESIGN PHILOSOPHY CREATION

Create a VISUAL PHILOSOPHY (not layouts or templates) interpreted through:
- Form, space, color, composition
- Images, graphics, shapes, patterns
- Minimal text as visual accent

### The Critical Understanding
- **Input**: User instructions (foundation, not constraint)
- **Output**: A design philosophy/aesthetic movement
- **Next Step**: Expressing it visually (90% design, 10% text)

### How to Generate a Visual Philosophy

**Name the movement** (1-2 words).

**Articulate the philosophy** (4-6 paragraphs):
Express how the philosophy manifests through space, form, color, scale, rhythm, composition, and hierarchy.

**Guidelines:**
- **Avoid redundancy**: Mention aspects once.
- **Emphasize craftsmanship**: Stress that the work must look meticulously crafted by an expert.
- **Leave creative space**: Specific aesthetic direction, but room for interpretation.

### Essential Principles
- **Visual Philosophy**: Aesthetic worldview.
- **Minimal Text**: Sparse, essential-only, integrated visually.
- **Spatial Expression**: Ideas communicate through space/form/color.
- **Artistic Freedom**: Interpret visually.
- **Pure Design**: Art objects, not documents.
- **Expert Craftsmanship**: Meticulous execution.

**Output**: A .md file containing the philosophy (4-6 paragraphs).

## DEDUCING THE SUBTLE REFERENCE

**Critical Step**: Identify the subtle conceptual thread. The topic is a subtle, niche reference embedded within the art itself. The design philosophy provides the aesthetic language; the topic provides the soul.

## CANVAS CREATION

Express the philosophy on a canvas. Create a single page, highly visual, design-forward PDF or PNG.

- **Sophistication**: Museum quality. Not cartoony.
- **Approach**: Treat abstract design as a scientific bible or systematic observation.
- **Text**: Contextual element. Minimal. Design-forward fonts.
- **Fonts**: Use different fonts from the **`skill-assets/canvas-design/`** directory. Bring the font onto the canvas artistically.
- **Craftsmanship**: Must look like it took countless hours. Flawless formatting. No overlaps.

**Output**: A single .pdf or .png file, alongside the philosophy .md file.

## FINAL STEP (Refinement)
Refine/polish further. Make it crisp. Respect minimalism. Ask: "How can I make what's already here more of a piece of art?"

## Multi-Page Option
Create additional creative pages that are distinctly different but philosophically aligned. Bundle in the same .pdf or many .pngs.

---

# Frontend Design
*Located in: `skill-assets/frontend-design/`*

Create distinctive, production-grade frontend interfaces with high design quality using standard coding practices or Stitch AI generation.

## Design Thinking

Before coding, understand the context and commit to a **BOLD** aesthetic direction:
- **Purpose**: Problem/Audience?
- **Tone**: Pick an extreme (minimal, maximalist, retro, luxury, etc.).
- **Constraints**: Tech stack/performance.
- **Differentiation**: What makes this unforgettable?

**CRITICAL**: Choose a clear conceptual direction and execute it with precision.

## Frontend Aesthetics Guidelines

- **Typography**: Unique, interesting fonts. Avoid generic choices (Arial, Inter). Pair distinctive display fonts with refined body fonts.
- **Color & Theme**: Cohesive aesthetic. CSS variables. Dominant colors with sharp accents.
- **Motion**: CSS-only animations, or Motion library for React. High-impact moments (page load, scroll triggers).
- **Spatial Composition**: Unexpected layouts, asymmetry, overlap, or controlled density.
- **Backgrounds**: Atmosphere and depth. Contextual effects, textures, gradients, noise, grain.

**NEVER** use generic AI aesthetics (overused fonts, cliched colors, cookie-cutter layouts).

**Match implementation complexity to the aesthetic vision.** Maximalist needs elaborate code; Minimalist needs restraint and precision.

## Stitch AI Integration

Leverage the **stitch** MCP server to generate and iterate on UI designs.

### Workflow
1.  **Project Management**:
    - List projects: `mcp_stitch_list_projects`
    - Create project: `mcp_stitch_create_project` (if needed)
2.  **Generation**:
    - Generate screen: `mcp_stitch_generate_screen_from_text`
    - Prompting: Be specific about layout, style, and components.
3.  **Refinement**:
    - Edit screen: `mcp_stitch_edit_screens`
    - Generate variants: `mcp_stitch_generate_variants`
4.  **Implementation**:
    - Retrieve details: `mcp_stitch_get_screen`
    - Use generated designs as visual references for code implementation.

---

# Skill Creator
*Located in: `skill-assets/skill-creator/`*

Guide for creating effective skills that extend Claude's capabilities.

## About Skills
Skills are modular packages providing specialized knowledge, workflows, and tools. They consist of a `SKILL.md` and optional bundled resources.

## Structure
```
skill-name/
├── SKILL.md (required)
└── Bundled Resources (optional)
    ├── scripts, references, assets - Executable code, documentation, output files
```

## Core Principles
1. **Concise is Key**: Only add context not already known.
2. **Set Appropriate Degrees of Freedom**: High (text), Medium (pseudocode), Low (scripts).
3. **Progressive Disclosure**:
    - Metadata (always in context)
    - Body (when triggered)
    - Resources (as needed)

## Skill Creation Process

1. **Understand with Examples**: How will the skill be used?
2. **Plan Reusable Contents**: Scripts, references, assets.
3. **Initialize**: Run **`skill-assets/skill-creator/init_skill.py`** to generate a template.
   ```bash
   python skill-assets/skill-creator/init_skill.py <skill-name> --path <output-directory>
   ```
4. **Edit**: Implement resources and write `SKILL.md`.
    - **Frontmatter**: `name` and `description` (triggering mechanism).
    - **Body**: Instructions.
5. **Package**: Run **`skill-assets/skill-creator/package_skill.py`** to validate and create a `.skill` file.
   ```bash
   python skill-assets/skill-creator/package_skill.py <path/to/skill-folder>
   ```
6. **Iterate**: Test and refine.

## Progressive Disclosure Patterns
- **High-level guide with references**: Link to external MD files.
- **Domain-specific**: Organize references by domain.
- **Conditional details**: Link to advanced features only when needed.

---

# Web Application Testing
*Located in: `skill-assets/webapp-testing/`*

Toolkit for interacting with/testing local web apps using Playwright.

## Tools
- **Helper Scripts**:
    - **`skill-assets/webapp-testing/with_server.py`**: Manages server lifecycle.

**Always run scripts with `--help` first.**

## Decision Tree
1. **Static HTML?** -> Read file directly.
2. **Dynamic Webapp?** ->
    - Server running? -> Reconnaissance-then-action.
    - Server NOT running? -> Use `with_server.py`.

## Example: Using with_server.py

**Single server:**
```bash
python skill-assets/webapp-testing/with_server.py --server "npm run dev" --port 5173 -- python your_automation.py
```

**Multiple servers:**
```bash
python skill-assets/webapp-testing/with_server.py \
  --server "cd backend && python server.py" --port 3000 \
  --server "cd frontend && npm run dev" --port 5173 \
  -- python your_automation.py
```

## Automation Script Template
```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto('http://localhost:5173')
    page.wait_for_load_state('networkidle') # CRITICAL
    # ... logic
    browser.close()
```

## Reconnaissance-Then-Action
1. **Inspect**: Screenshot + Content + Locators.
2. **Identify**: Selectors.
3. **Execute**: Actions.

## Best Practices
- Use bundled scripts as black boxes.
- Wait for `networkidle` before inspection.
- Use descriptive selectors.
- `skill-assets/webapp-testing/` contains patterns for element discovery, static HTML, and console logging.
