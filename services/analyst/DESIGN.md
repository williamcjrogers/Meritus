---
version: alpha
colors:
  primary: "#2C659A"
  harbour: "#152D43"
  sky: "#EDF3F8"
  white: "#FFFFFF"
  slate: "#526575"
  amber: "#A66B16"
  red: "#A23A34"
  green: "#267052"
  ink: "#172733"
  border: "#CCD8E2"
typography:
  display:
    fontFamily: '"Avenir Next", Avenir, "Segoe UI", sans-serif'
    fontSize: "2rem"
    lineHeight: "1.15"
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "0.9375rem"
    lineHeight: "1.5"
  data:
    fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", monospace'
    fontSize: "0.8125rem"
    lineHeight: "1.4"
rounded:
  control: "0.375rem"
  surface: "0.625rem"
  status: "999px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
components:
  navigation:
    backgroundColor: "{colors.harbour}"
    textColor: "{colors.white}"
    width: "224px"
  table:
    backgroundColor: "{colors.sky}"
    textColor: "{colors.ink}"
    height: "52px"
  evidencePair:
    backgroundColor: "{colors.white}"
    textColor: "{colors.harbour}"
    width: "3px"
  focus:
    backgroundColor: "{colors.primary}"
    width: "3px"
  metadata:
    textColor: "{colors.slate}"
  warningStatus:
    backgroundColor: "{colors.white}"
    textColor: "{colors.harbour}"
  warningMarker:
    backgroundColor: "{colors.amber}"
    size: "0.42rem"
  errorStatus:
    backgroundColor: "{colors.white}"
    textColor: "{colors.red}"
  successStatus:
    backgroundColor: "{colors.white}"
    textColor: "{colors.green}"
  divider:
    backgroundColor: "{colors.border}"
    height: "1px"
---

# Meritus analyst desk design

## Overview

Meritus is a product interface for UK construction claims analysts who need to trace a ranked signal back to admissible evidence quickly. It should feel like a disciplined project control room: steel-blue navigation, a bright working surface, compact records and unusually clear source lineage. The visual register is product-first and evidence-led.

The signature is the evidence pair. A narrow blue rule joins a source label, event name and age to the evidence headline or detail. It appears in ranked rows and detail views, so source provenance is visible before an analyst acts. Decoration elsewhere stays restrained. The interface must never resemble a generic statistic-card dashboard, a newspaper page or a consumer finance app.

This file is the canonical authoring source for visual tokens. `web/src/styles.css` maps each durable token once to a CSS custom property; shared components consume semantic variables. Any token change updates this file and that mapping together.

## Colors

Deep harbour owns the navigation rail and highest-emphasis text. Blue identifies navigation, links, focus and the evidence-pair rule. Pale sky separates controls and supporting information from the white working surface. Slate is secondary text. Amber is reserved for incomplete coverage, permissions and provisional states. Red and green appear only with explicit text or icons for error and verified/success states.

White is the main working surface. Borders use the dedicated cool grey token. Raw palette values must not appear in component files.

## Typography

Avenir Next is used sparingly for product identity and page headings, with installed fallbacks and no remote font request. The platform system sans carries interface copy. SFMono or Consolas carries identifiers, score values, dates and source metadata. Body text remains sentence case; headings use natural capitalisation rather than all-caps display styling.

## Layout

At desktop widths, a fixed 224px rail frames a spacious white work surface. Lists and semantic tables lead. Where a selected record is meaningful, the working area may divide into a flexible list and a 360px evidence panel. At widths below 860px, navigation becomes a horizontal, scrollable landmark and detail regions stack into one column without dropping actions or evidence links.

The spacing rhythm is compact around metadata and generous between task regions. Tables are bounded to 25 rows per client page unless the API exposes its own bound. The document owns vertical scrolling; table wrappers own horizontal overflow only.

## Elevation & Depth

Static content is flat. Borders and pale-sky fills establish hierarchy. Dialogs and the navigation shell may use one restrained shadow because they sit above the work surface. Loading, validation and notification states reserve their space so controls do not jump.

## Shapes

Controls use a 6px radius and content surfaces use 10px. Status labels may use a pill only because they represent compact states. Large decorative capsules and nested card stacks are out of character.

## Components

All routes share the same `Button`, `Field`, `SelectField`, `Status`, `TableFrame`, `StatePanel`, `Dialog`, `ToastProvider` and `SearchField` owners. Buttons combine emphasis and semantic intent. Native select popups are accepted on the supported local desktop browser matrix. Dates use a typed `DD/MM/YYYY` field with deterministic UK parsing, because the product must display one format and preserve date-only values without UTC conversion.

The global stylesheet owns visible scrollbars, focus rings, reduced-motion behaviour and overlay layers. The evidence-pair component owns the signature source/event/age grouping. Lucide-style line icons may supplement labels, but no action relies on an icon alone.

## Do's and Don'ts

- Do put source, event and age beside evidence links.
- Do distinguish empty data, no search results, partial coverage, permission blocks and request failure.
- Do keep table actions and evidence links available at narrow widths.
- Do use amber for provisional dates and permission consequences.
- Do not use oversized generic statistic cards or decorative gradients.
- Do not hide scrollbars, source lineage or incomplete coverage.
- Do not load remote fonts or place raw colours in route components.
