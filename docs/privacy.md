# Playball — Privacy Policy

**Effective date:** September 7, 2026
**Developer:** Hans Henriquez (Hoodian)
**App:** Playball — College Baseball Dynasty, package `com.playball.dynasty`

## The short version

Playball does not collect, transmit or sell any personal information.
Everything the game knows lives on your device. Nothing is ever sent to the
developer or to anyone else. The only copy that can leave the phone is your
own Android device backup, if you have it turned on (see below).

## What the app stores, and where

Playball is a single-player game that runs entirely on your phone. It keeps:

- **Your careers (save files).** Stored in your device's local app storage
  (IndexedDB inside the app's own web view). They are never uploaded anywhere.
- **Your device preferences.** Theme, text size, sound, haptics and the
  God Mode entitlement, stored locally on the device.

If you uninstall the app, this data is deleted from the device. If Android
backup is turned on, your careers and preferences can be included in your own
Google account backup, and restored when you reinstall the app or set up a
new phone. That backup is Android's and belongs to your Google account; the
developer cannot see it. You can turn it off in Android Settings → System →
Backup. The app has no account system, no login, and no cloud sync of its own.

## What the app does not do

- It does not collect names, email addresses, contacts, location, photos,
  device identifiers, advertising identifiers or usage analytics.
- It does not contain advertising.
- It does not use third-party analytics or tracking SDKs.
- It does not connect to any server operated by the developer. The app
  works fully offline.

## In-app purchase

Playball offers one optional in-app purchase, **God Mode**, processed by
Google Play Billing. The developer never sees your payment details; the
transaction is handled entirely by Google under the
[Google Play Terms of Service](https://play.google.com/about/play-terms/) and
[Google's Privacy Policy](https://policies.google.com/privacy). The only thing
the app records is whether the purchase is owned, stored locally on your
device so the feature stays unlocked.

## Children

Playball does not knowingly collect any information from anyone, including
children. It contains no user-generated content, chat, or social features.

## Permissions

The app requests no runtime permissions, so it never asks you for anything.
It declares two install-time permissions: Google Play Billing
(`com.android.vending.BILLING`), only to support the optional purchase
described above, and vibration (`android.permission.VIBRATE`), only for the
Haptics setting.

## Changes to this policy

If this policy ever changes, the updated version will be published at this
same address with a new effective date. Since the app collects nothing, a
change would only ever add clarity, not new data collection.

## Contact

Questions about this policy: hanssmell2@gmail.com

<!--
  MAINTAINER'S NOTE, not shown as policy text above.

  Every claim in this document is true of v1.0, which has no accounts and
  no server. Stage 30 (`docs/07-v1-plan.md`) adds a login and a shared
  record book, and the day that ships this file and the Play Data Safety
  declaration must both change in the SAME release: an account identity,
  a public username, submitted gameplay marks, and an in-app and web route
  to delete the account, which Play requires. Do not ship the feature
  against this text.
-->

