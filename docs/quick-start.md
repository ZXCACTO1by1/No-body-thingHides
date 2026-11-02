# Quick start

1. Extract the entire Windows x64 archive into a folder you can read. Keep its
   executable, resources and upstream runtime together.
2. Run `Start.cmd` or open `NoBodyThingHides.exe`. The local interface opens in your
   browser. Keep the application running while searching.
3. Enter a username without `@` or a profile URL. Choose Quick to start with popular
   services, or Deep for the full eligible catalogue.
4. Select Start search. Current activity shows the stage, counts and elapsed time.
5. Open Results. Expand a service to see distinct account cards and evidence.

Use Stop and save when you need to interrupt work. Continue resumes the saved
finite plan. An interrupted search may already have useful accounts; its pending
work is shown separately. Closing the browser does not delete saved results.

The language selector switches between English and Russian. Settings stores
preferences for future searches. The collapsed search settings let you control
concurrency, candidates, links, depth, time and request budgets. Empty overall
time/request limits leave the run uncapped; a Deep search can take substantial time.

Data defaults to `%LOCALAPPDATA%\NoBodyThingHides`. For an explicit portable data
directory, use the [CLI launch option](cli.md). See [Results](results.md) before
interpreting account matches and [Privacy](privacy.md) before sharing exports.

## Tools and saved investigations

Tools are grouped by purpose and can be filtered by name or group. The database
panel reports whether local investigation storage is ready. Preparing the database
is an explicit operation with no input fields: open it and select Run tool.

A username report in Results and a named database investigation are separate
records. For database tools, prepare the database, create an investigation with
a useful name, add starting objects with their types, then select the appropriate
checks or views. Newly created investigations appear in selectors without reloading.
Choose by name; expand Selected item identifier beneath the selector to view or
copy its full internal ID. Objects and runs follow the selected investigation.
Missing data and unreadable storage have separate explanations and prerequisite
actions where available.

Tools open Current activity after launch. Completed tools have View tool output;
searches have Open result. Tool output may contain investigation data: review it
before sharing. Referenced saved investigations have a details action. Show older
operations expands the bounded latest-operation list. Stop and save and Continue
remain available after reloading the page.

Required fields are marked `*`; invalid values focus the corresponding field.
Settings remain editable during an operation. Configure provider keys through the
separate system-credential form. Closing a form clears password fields. For files,
use Choose file or choose a saved report; uploads are limited to 8 MB in total.
Provider access limits and unimplemented transports still apply.
