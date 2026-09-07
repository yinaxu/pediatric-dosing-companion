# Pediatric Dosing Companion

[![Try it now](https://img.shields.io/badge/Try%20it%20now-Live%20Demo-0F6E5E?style=for-the-badge)](https://yinaxu.github.io/pediatric-dosing-companion/)

A dosing reference for the antibiotics and OTC medications kids get prescribed most often. Enter a weight, and it shows you a safe dose in seconds instead of doing the math by hand. Age is optional.

## Why this exists

Pediatric dosing is weight-based, so every patient needs their own calculation. Getting that math right, and remembering the correct ceiling so a bigger or heavier kid doesn't end up on a dose that scaled too far, takes real attention when you're busy. This tool handles the calculation for you and shows a low-end and high-end option so you can see the full range before deciding what fits.

## What it does

Type in a child's weight, and optionally their age, and the page updates to show:

- A low and high dosing option for each medication, so you can see the typical range rather than a single number
- The actual liquid volume in milliliters, based on the real concentrations these medications come in
- A built-in maximum dose, so the calculation stops scaling up once it hits the standard safety ceiling
- Multiple dosing schedule options where they apply, like twice a day versus three or four times a day
- Adult dosing shown alongside the pediatric calculation when a patient's weight or age falls into that range

## What's covered

**Antibiotics:** amoxicillin, Augmentin, cephalexin, penicillin VK, cefdinir, cefixime, cefpodoxime, clindamycin, trimethoprim-sulfamethoxazole, and azithromycin

**Over-the-counter medications:** acetaminophen, ibuprofen, cetirizine, and loratadine

**Other prescription medications:** famotidine, ondansetron, lactulose, polyethylene glycol 3350, prednisolone, dexamethasone, levetiracetam, phenobarbital, diazepam, and oxycodone. Controlled substances (phenobarbital, diazepam, oxycodone) are flagged with a red tag on their card.

## How to use it

1. Enter the child's weight in pounds or kilograms. Age is optional and only needed for the two antihistamines.
2. The page updates automatically, so you don't have to click through separate screens for each medication.
3. Select the medication or two you're working with right now, and they'll gather in their own box at the top. Everything else stays listed further down the page.
4. Check the low and high dose, the matching liquid volume, and the maximum dose warning if one shows up.

## Installing it as an app

The site can be added to a phone's home screen like a real app, with its own icon, and it opens full-screen without the browser address bar. It also works with no signal once it's been opened at least once.

A banner appears automatically near the top of the page prompting people to add it, with a single button. On iPhones, tapping that button opens a short set of instructions, since Apple requires the last step (tapping "Add to Home Screen" in Safari's share menu) to be done by hand. On Android, tapping the button triggers the phone's own install prompt directly.

Nothing needs to be downloaded from an app store. This all comes from the same files already in this repo (`manifest.json`, `sw.js`, and the icons in the `icons` folder), so as long as those stay in the repo alongside `index.html`, the install feature keeps working after every future update.

## A note on safety

This is a quick reference and a second check on your own calculation. It doesn't replace professional judgment. Confirm every dose against a current drug reference and against the specific patient's health history, allergies, and the reason they're being treated before giving it.

## The "Try it now" button

The green button at the top of this page is a markdown link styled to look like a button, and it already points to your live site:

```
[![Try it now](https://img.shields.io/badge/Try%20it%20now-Live%20Demo-0F6E5E?style=for-the-badge)](https://yinaxu.github.io/pediatric-dosing-companion/)
```

The part in the second set of parentheses is the actual destination. If you ever rename the repo or move the site somewhere else, that's the only piece you need to update, then push the change (`git add README.md`, `git commit -m "update live demo link"`, `git push`) and GitHub will refresh the button right away.

If you'd rather have a plain text link instead of a colored button, you can swap the whole line for something simpler:
```
[Try it now](https://yinaxu.github.io/pediatric-dosing-companion/)
```
Same idea, just without the badge styling.
