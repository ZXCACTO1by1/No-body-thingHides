# Command line

Run commands from a terminal using the executable in the extracted application
folder. Quote paths that contain spaces. `--help` lists the installed release's
commands and supported options.

```powershell
.\NoBodyThingHides.exe --help
.\NoBodyThingHides.exe --language en tools personal-search example_handle --mode quick --output "C:\Search data\Reports"
.\NoBodyThingHides.exe --language ru tools personal-search --resume "C:\Search data\Reports\saved-job"
.\NoBodyThingHides.exe tools easy-web --home "C:\Search data" --port 8770
```

The root `--language en|ru` selects presentation for that invocation. Quick and
Deep are `--mode quick` and `--mode deep`. `--request-budget` and `--task-timeout`
bound a run; `--concurrency`, `--candidate-limit`, `--link-limit` and `--max-depth`
control resources. Saved plan continuation uses `--resume`.

Use `tools easy-web --home` for explicit portable storage. Keep its server on the
numeric loopback address. Do not publish the local server or share its session.
The normal graphical launch uses the default per-user directory.

Readable CLI output can be saved in a custom folder. The Web Results list indexes
its own Reports directory. Raw machine fields and upstream source output retain
their original codes and text. Use Tools for the original Maigret editor,
extraction and saved-data operations; individual command help lists their inputs.
