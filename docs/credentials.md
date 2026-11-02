# Provider configuration

Quick and Deep use configured official Twitch, YouTube and GitHub APIs inside the
ordinary username workflow. Other sources continue when a setting is absent;
the unresolved check records its dependency. Settings show whether credentials
are present, without displaying their values. Presence alone does not confirm
that a provider accepts a credential.

From a terminal in the extracted application directory:

```text
NoBodyThingHides.exe credentials set twitch_client_id
NoBodyThingHides.exe credentials set twitch_client_secret
NoBodyThingHides.exe credentials set youtube
NoBodyThingHides.exe credentials set github
NoBodyThingHides.exe credentials status
```

Each `set` command asks for the value using hidden input and the existing system
credential store. Twitch requires a registered application's client ID/secret;
YouTube requires a Data API v3 key with suitable restrictions. A GitHub token is
optional for public profile requests. Do not put secrets in search arguments,
reports, recipes or issue attachments.

The public Telegram preview parser is enabled. Native MTProto transport is not
implemented or activated; entering a Bot API token does not activate it. Fresh
provider controls and live acceptance are required before claiming recovery of
unresolved accounts. See [result interpretation](results.md) and
[инструкцию на русском](ru/credentials.md).
