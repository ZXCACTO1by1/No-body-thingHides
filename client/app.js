"use strict";
const $ = (selector) => document.querySelector(selector);
let language = "en", messages = {}, catalog = [], preferences = {}, results = [], selections = {};
let screen = "search", busy = false, selectedTool = null, selectedResult = null;
let resultGeneration = 0, jobRefresh = null, jobSnapshot = "", opener = null;
let originalGeneration = 0;
let originalLoading = false, outputGeneration = 0, outputOpener = null;
let resultListSnapshot = "";
let workspace = { database: { state: "MISSING" } }, workspaceLoaded = false, historyLimit = 12, postPending = false, ready = false;
const toolDrafts = new Map();
const knownJobStates = new Map(), pendingJobActions = new Set();
const resultViews = new Map();
function t(key, parameters = {}) {
  const text = messages[key] || messages["error.generic"] || "The operation could not finish.";
  return text.replace(/\{([a-z_]+)\}/g, (_, name) => String(parameters[name] ?? ""));
}
function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}
function notice(message) {
  const root = $("#notice"); root.replaceChildren(node("span", message));
  const dismiss = node("button", t("ui.dismiss")); dismiss.type = "button";
  dismiss.addEventListener("click", () => { root.hidden = true; }); root.append(dismiss); root.hidden = false;
}
function status(value) { return messages["status." + value] || t("ui.state_details"); }
async function request(path, method = "GET", body) {
  const options = { method, headers: { "X-NBTH-Token": TOKEN } };
  if (body !== undefined) { options.headers["Content-Type"] = "application/json"; options.body = JSON.stringify(body); }
  let response, value;
  try { response = await fetch(path, options); value = await response.json(); }
  catch { $("#connection-retry").hidden = false; throw Error(t("ui.connection_error")); }
  if (!response.ok) {
    const keys = { INVALID_REQUEST: "error.invalid_input", RELEASE_UNAVAILABLE: "error.release_unavailable", SESSION_REQUIRED: "error.session_required", RESULT_NOT_FOUND: "error.result_not_found", PROJECTION_UNAVAILABLE: "error.projection_unavailable", INCOMPATIBLE_SCHEMA: "error.incompatible_core", OPERATION_BUSY: "error.operation_busy", DATABASE_REQUIRED: "error.database_required", DATABASE_UNAVAILABLE: "error.database_unavailable", FIELD_REQUIRED: "error.field_required", INVALID_FIELD: "error.invalid_field", SAVED_DATA_REQUIRED: "error.saved_data_required", INPUT_LIMIT: "error.input_limit" };
    const error = Error(t(keys[value.code] || "error.generic", value.field ? { field: messages["field." + value.field + ".label"] || value.parameters?.field || "" } : {}));
    error.fieldName = value.field; error.code = value.code; throw error;
  }
  $("#connection-retry").hidden = true;
  return value;
}
const easy = (path, method, body) => request("/api/easy/" + path, method, body);
const release = (path) => request("/api/release/v1/" + path);
document.querySelectorAll("dialog").forEach((dialog) => dialog.addEventListener("keydown", (event) => {
  if (event.key !== "Tab") return;
  const controls = [...dialog.querySelectorAll('button,a[href],input,select,textarea,summary,[tabindex="0"]')].filter((control) => !control.disabled && control.getClientRects().length);
  const first = controls[0], last = controls.at(-1);
  if (first && (event.shiftKey && document.activeElement === first || !event.shiftKey && document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
}));
function localizePage() {
  document.documentElement.lang = language;
  $("#language").value = language;
  document.querySelectorAll("[data-i18n]").forEach((element) => { element.textContent = t(element.dataset.i18n); });
  $("#close-dialog").setAttribute("aria-label", t("action.close"));
  document.querySelector("nav").setAttribute("aria-label", t("ui.navigation"));
}
function switchScreen(name, focus = true) {
  if (!["search", "results", "activity", "tools", "settings"].includes(name)) return;
  screen = name;
  document.querySelectorAll("[id^=screen-]").forEach((section) => { section.hidden = section.id !== "screen-" + name; });
  document.querySelectorAll("nav button").forEach((button) => {
    if (button.dataset.screen === name) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  if (focus) $("#content").focus();
}
document.querySelectorAll("[data-screen]").forEach((button) => button.addEventListener("click", () => switchScreen(button.dataset.screen)));
function validate(container) {
  container.querySelectorAll("[aria-invalid]").forEach((control) => control.removeAttribute("aria-invalid"));
  for (const control of container.querySelectorAll("[data-name], #nickname")) {
    if (control.disabled || control.checkValidity()) continue;
    const name = control.dataset.name || "username";
    const label = messages["field." + name + ".label"] || (name === "username" ? t("search.username") : name);
    const error = Error(t(control.validity.valueMissing ? "error.field_required" : "error.invalid_field", { field: label }));
    error.fieldName = name; throw error;
  }
}
function markError(error, container) {
  const control = [...container.querySelectorAll("[data-name], #nickname")].find((input) => (input.dataset.name || "username") === error.fieldName);
  if (control) { control.setAttribute("aria-invalid", "true"); control.focus(); }
}
const savedName = (name) => name.endsWith("entity_id") ? "entity_id" : ["parent_run", "parent_run_id"].includes(name) ? "run_id" : name;
const savedField = (name) => ["investigation_id", "entity_id", "run_id", "case", "resume", "candidate_id", "evidence_id"].includes(savedName(name));
function updateSavedChoices(container) {
  const investigation = container.querySelector('[data-name="investigation_id"]')?.value;
  container.querySelectorAll("select[data-saved-name]").forEach((control) => {
    const previous = control.value;
    const options = (selections[control.dataset.savedName] || []).filter((item) => !investigation || !item.investigation_id || item.investigation_id === investigation);
    const uploaded = [...control.options].filter((option) => option.dataset.uploaded);
    control.replaceChildren(new Option(t(options.length || uploaded.length ? "ui.select" : "ui.empty_saved"), ""));
    options.forEach((option) => control.append(new Option(option.label, option.value))); uploaded.forEach((option) => control.append(option));
    if (previous && [...control.options].some((option) => option.value === previous)) control.value = previous;
    else if (control.required && options.length === 1) control.value = options[0].value;
    control.dispatchEvent(new Event("selection-updated"));
  });
}
function canRunTool() {
  const missing = selectedTool?.needs_database && (!workspaceLoaded || workspace.database.state !== "READY");
  const empty = [...$("#operation-fields").querySelectorAll("select[data-saved-name]")].some((control) => control.required && control.options.length < 2);
  return ready && !postPending && !originalLoading && !(busy && selectedTool?.id !== "credentials-set") && !missing && !empty;
}
function updateRunState() {
  $("#busy-banner").hidden = !busy;
  $("#operation-submit").disabled = !canRunTool();
}
function toolAction(identifier, label, values = {}) {
  const button = node("button", t(label)); button.type = "button";
  button.addEventListener("click", () => {
    const operation = catalog.find((item) => item.id === identifier); if (!operation) return;
    if (selectedTool && $("#operation-dialog").open) saveToolDraft();
    openTool(operation, button, values).catch((error) => notice(error.message));
  }); return button;
}
function saveToolDraft() {
  if (!selectedTool) return;
  const values = formValues($("#operation-fields"));
  selectedTool.parameters.filter((parameter) => parameter.secret).forEach((parameter) => delete values[parameter.name]);
  $("#operation-fields").querySelectorAll('input[type="password"]').forEach((control) => delete values[control.dataset.name]);
  toolDrafts.set(selectedTool.id, values);
}
function renderPrerequisite() {
  const root = $("#operation-prerequisite"); root.replaceChildren(); root.hidden = true;
  if (busy && selectedTool?.id !== "credentials-set") { root.append(node("p", t("error.operation_busy"))); root.hidden = false; }
  if (selectedTool?.needs_database && workspace.database.state !== "READY") {
    root.append(node("p", t(workspace.database.state === "UNAVAILABLE" ? "error.database_unavailable" : "error.database_required")));
    if (workspace.database.state !== "UNAVAILABLE") root.append(toolAction("init-db", "ui.prepare_db")); root.hidden = false;
  } else {
    const empty = [...$("#operation-fields").querySelectorAll("select[data-saved-name]")].find((control) => control.required && control.options.length < 2);
    if (empty) {
      root.append(node("p", t("error.saved_data_required")));
      const investigation = $("#operation-fields").querySelector('[data-name="investigation_id"]')?.value;
      if (empty.dataset.savedName === "investigation_id") root.append(toolAction("investigation-create", "ui.create_investigation"));
      else if (empty.dataset.savedName === "entity_id") root.append(toolAction("seed-add", "ui.add_seed", { investigation_id: investigation }));
      else if (empty.dataset.savedName !== "case" && empty.dataset.savedName !== "resume") root.append(toolAction("run-start", "ui.start_processing", { investigation_id: investigation }));
      else root.append(node("p", t("ui.search_before_report"))); root.hidden = false;
    }
  }
  updateRunState();
}
async function refreshWorkspace() {
  const state = await easy("workspace"); let saved;
  try { saved = await easy("selections"); }
  catch (error) { if (error.code !== "DATABASE_UNAVAILABLE") throw error; state.database.state = "UNAVAILABLE"; saved = {investigation_id:[],entity_id:[],run_id:[],evidence_id:[],candidate_id:[]}; }
  workspace = state; workspaceLoaded = true; selections = { ...selections, ...saved };
  $("#workspace-state").textContent = t("ui.workspace_" + state.database.state.toLowerCase(), state.database);
  const actions = $("#workspace-actions"); actions.replaceChildren();
  if (["MISSING", "NEEDS_UPDATE"].includes(state.database.state)) actions.append(toolAction("init-db", "ui.prepare_db"));
  if (state.database.state === "READY") actions.append(toolAction("investigation-create", "ui.create_investigation"), toolAction("investigation-list", "ui.list_investigations"));
  const refresh = node("button", t("ui.refresh_workspace")); refresh.type = "button";
  refresh.addEventListener("click", () => refreshWorkspace().catch((error) => notice(error.message))); actions.append(refresh);
  if ($("#operation-dialog").open) { updateSavedChoices($("#operation-fields")); renderPrerequisite(); }
}
function formValues(container, retainBlank = false) {
  const values = {};
  container.querySelectorAll("[data-name]").forEach((input) => {
    if (input.type === "checkbox") { values[input.dataset.name] = input.checked; return; }
    if (!input.value.trim()) { if (retainBlank) values[input.dataset.name] = ""; return; }
    values[input.dataset.name] = input.dataset.multiple === "true"
      ? input.value.split("\n").map((value) => value.trim()).filter(Boolean)
      : input.type === "number" ? Number(input.value) : input.value.trim();
  });
  return values;
}
function field(parameter, container, value) {
  const box = node("div", undefined, "field");
  let control;
  const choices = parameter.name === "provider" ? ["hunter", "securitytrails", "twitch_client_id", "twitch_client_secret", "youtube", "github"] : parameter.choices || [];
  const saved = savedField(parameter.name) ? selections[savedName(parameter.name)] || [] : undefined;
  if (!parameter.multiple && (parameter.kind === "choice" || choices.length || saved)) {
    control = node("select"); control.append(new Option(t("ui.select"), ""));
    (saved || choices.map((choice) => ({ value: choice, label: messages["choice." + choice] || String(choice) }))).forEach((choice) => control.append(new Option(choice.label, choice.value)));
  } else if (parameter.multiple) control = node("textarea");
  else { control = node("input"); control.type = parameter.kind === "boolean" ? "checkbox" : ["integer", "number"].includes(parameter.kind) ? "number" : parameter.secret ? "password" : "text"; }
  control.id = container.id + "-" + parameter.name;
  control.dataset.name = parameter.name;
  control.dataset.multiple = String(parameter.multiple);
  control.required = parameter.required;
  if (control.type === "checkbox") control.checked = value === true;
  else control.value = Array.isArray(value) ? value.join("\n") : value ?? "";
  if (parameter.minimum != null) control.min = parameter.minimum;
  if (parameter.maximum != null) control.max = parameter.maximum;
  if (control.type === "number") control.step = parameter.kind === "integer" ? "1" : "any";
  if (["text", "password"].includes(control.type) || control.tagName === "TEXTAREA") control.maxLength = 8192;
  const label = node("label", parameter.label + (parameter.required ? " *" : "")); label.htmlFor = control.id;
  const hint = node("small", parameter.help || ""); hint.id = control.id + "-hint";
  control.setAttribute("aria-describedby", hint.id);
  box.append(label, control, hint);
  if (saved && control.tagName === "SELECT") {
    control.dataset.savedName = savedName(parameter.name);
    const file = ["case", "resume"].includes(parameter.name);
    const info = node("details", undefined, "selection-details"); info.append(node("summary", t(file ? "ui.selection_file" : "ui.selection_id")));
    const code = node("code"); const copy = node("button", t(file ? "ui.copy_location" : "ui.copy_id")); copy.type = "button";
    const changed = () => { code.textContent = control.value || t("ui.empty_saved"); copy.disabled = !control.value; };
    copy.addEventListener("click", async () => { try { await navigator.clipboard.writeText(control.value); notice(t("ui.copied")); } catch { info.open = true; notice(t("ui.copy_manual")); } });
    info.append(code, copy); box.append(info); control.addEventListener("selection-updated", changed);
    control.addEventListener("change", () => { changed(); updateSavedChoices(container); if (container.id === "operation-fields") renderPrerequisite(); }); changed();
  }
  if (parameter.kind === "file" && !["output", "home", "history", "database_url"].includes(parameter.name)) {
    const picker = node("input"); picker.type = "file"; picker.hidden = true; picker.multiple = parameter.multiple;
    picker.accept = ".html,.htm,.json,.txt,.csv,.xml,.mhtml,.yaml,.yml,.ini";
    const button = node("button", t("ui.choose_file")); button.type = "button";
    button.addEventListener("click", () => picker.click());
    picker.addEventListener("change", async () => {
      button.disabled = true;
      try {
        if (picker.files.length > 100 || [...picker.files].reduce((sum, file) => sum + file.size, 0) > 8 * 1024 * 1024) throw Error(t("ui.file_limit"));
        const paths = [];
        for (const file of picker.files) {
          const buffer = new Uint8Array(await file.arrayBuffer()); let binary = "";
          for (let i = 0; i < buffer.length; i += 16384) binary += String.fromCharCode(...buffer.subarray(i, i + 16384));
          paths.push((await easy("uploads", "POST", { name: file.name, body_base64: btoa(binary) })).path);
        }
        if (control.tagName === "SELECT") paths.forEach((path, index) => { const option = new Option(picker.files[index].name, path); option.dataset.uploaded = "true"; control.append(option); });
        control.value = parameter.multiple ? paths.join("\n") : paths[0] || "";
        control.dispatchEvent(new Event("selection-updated")); if (container.id === "operation-fields") renderPrerequisite();
      } catch (error) { notice(error.message); }
      finally { button.disabled = false; picker.value = ""; }
    });
    box.append(button, picker);
  }
  container.append(box); return control;
}
function renderSettings(searchValues = {}, savedValues = {}) {
  const main = catalog.find((operation) => operation.id === "tools-personal-search");
  const names = ["concurrency", "candidate_limit", "link_limit", "max_depth", "request_budget", "task_timeout"];
  $("#search-options").replaceChildren(); $("#preference-fields").replaceChildren();
  main.parameters.filter((parameter) => names.includes(parameter.name)).forEach((parameter) => {
    field(parameter, $("#search-options"), Object.hasOwn(searchValues, parameter.name) ? searchValues[parameter.name] : preferences[parameter.name] ?? parameter.default);
    field(parameter, $("#preference-fields"), Object.hasOwn(savedValues, parameter.name) ? savedValues[parameter.name] : preferences[parameter.name] ?? parameter.default);
  });
  const mode = main.parameters.find((parameter) => parameter.name === "mode");
  field(mode, $("#preference-fields"), savedValues.mode ?? preferences.mode ?? mode.default);
  easy("credentials").then((result) => { const root = $("#provider-status"); root.replaceChildren(); result.providers.forEach((provider) => {
    const row = node("div", undefined, "provider-row");
    row.append(node("p", (messages["choice." + provider.provider] || provider.provider) + " · " + t(provider.configured ? "recovery.configured" : "recovery.missing")), toolAction("credentials-set", "ui.configure_provider", { provider: provider.provider })); root.append(row);
  }); }).catch((error) => notice(error.message));
}
function renderTools() {
  const root = $("#tool-list"); root.replaceChildren();
  const groupNames = ["search", "extract", "results", "analysis", "settings", "tools"];
  const selectedGroup = $("#tool-group").value;
  $("#tool-group").replaceChildren(new Option(t("ui.group_all"), "all"));
  const groups = new Map();
  groupNames.forEach((name) => {
    $("#tool-group").append(new Option(t("ui.group_" + name), name));
    const group = node("section", undefined, "tool-group"); group.dataset.group = name;
    group.append(node("h2", t("ui.group_" + name)));
    const cards = node("div", undefined, "cards"); group.append(cards); groups.set(name, cards); root.append(group);
  });
  $("#tool-group").value = selectedGroup || "all";
  catalog.filter((operation) => !["tools-personal-search", "tools-easy-web"].includes(operation.id)).forEach((operation) => {
    const card = node("article", undefined, "card"); card.dataset.filter = (operation.title + " " + operation.description).toLocaleLowerCase();
    card.append(node("h2", operation.title), node("p", operation.description));
    (operation.capability_statuses || []).filter((value) => value !== "STABLE").forEach((value) => card.append(node("span", status(value), "badge")));
    if (operation.needs_database) card.append(node("p", t("ui.database_tool"), "hint"));
    const button = node("button", t("ui.open_tool")); button.dataset.operationId = operation.id;
    button.addEventListener("click", () => openTool(operation, button).catch((error) => notice(error.message))); card.append(button); (groups.get(operation.section) || groups.get("tools")).append(card);
  });
  filterTools();
}
function filterTools() {
  const query = $("#tool-filter").value.toLocaleLowerCase();
  const group = $("#tool-group").value;
  $("#tool-list").querySelectorAll(".tool-group").forEach((section) => {
    section.querySelectorAll(".card").forEach((card) => { card.hidden = !card.dataset.filter.includes(query); });
    section.hidden = group !== "all" && section.dataset.group !== group || !section.querySelector(".card:not([hidden])");
  });
  const total = $("#tool-list").querySelectorAll(".card").length;
  const count = [...$("#tool-list").querySelectorAll(".tool-group:not([hidden]) .card:not([hidden])")].length;
  $("#tool-count").textContent = t("ui.tools_count", { count, total });
}
$("#tool-filter").addEventListener("input", filterTools);
$("#tool-group").addEventListener("change", filterTools);
async function openTool(operation, button, retained = {}, special = {}, retainedSettings = {}) {
  if (operation.alias) {
    if (operation.alias === "classic") { window.open("/", "_blank", "noopener"); return; }
    switchScreen(operation.alias === "tools" ? "settings" : operation.alias); return;
  }
  const generation = ++originalGeneration;
  originalLoading = false;
  await refreshWorkspace(); if (generation !== originalGeneration) return;
  retained = { ...(toolDrafts.get(operation.id) || {}), ...retained };
  selectedTool = operation; if (button) opener = button;
  $("#operation-title").textContent = operation.title; $("#operation-help").textContent = operation.description;
  $("#operation-fields").replaceChildren(); $("#special-fields").replaceChildren(); $("#form-error").hidden = true;
  if (operation.id !== "advanced-maigret") operation.parameters.filter((parameter) => !["home", "database_url"].includes(parameter.name)).forEach((parameter) => field(parameter, $("#operation-fields"), Object.hasOwn(retained, parameter.name) ? retained[parameter.name] : parameter.default));
  updateSavedChoices($("#operation-fields"));
  $("#no-tool-inputs").hidden = $("#operation-fields").children.length > 0 || ["credentials-set", "advanced-analyze", "advanced-maigret"].includes(operation.id);
  if (operation.id === "credentials-set") field({ name: "connection_key", kind: "text", secret: true, required: true, label: t("ui.connection_key"), help: t("ui.key_hint") }, $("#special-fields"), special.connection_key);
  if (operation.id === "advanced-analyze") {
    $("#special-fields").append(node("p", t("ui.analysis_confirmation"), "hint"));
    field({ name: "api_key", kind: "text", secret: true, label: t("ui.ephemeral_key"), help: t("ui.ephemeral_hint") }, $("#special-fields"), special.api_key);
    field({ name: "confirmed", kind: "boolean", required: true, label: t("ui.confirm_send"), help: "" }, $("#special-fields"), special.confirmed === true);
  }
  if (!$("#operation-dialog").open) $("#operation-dialog").showModal();
  renderPrerequisite();
  if (operation.id === "advanced-maigret") {
    originalLoading = true;
    $("#operation-form > button").disabled = true;
    try {
      const schema = await easy("original");
      if (generation !== originalGeneration || !$("#operation-dialog").open) return;
      const convert = (p) => ({ ...p, kind: p.choices.length && !p.multiple ? "choice" : p.type === "path" ? "file" : p.type });
      schema.parameters.forEach((p) => field(convert(p), $("#operation-fields"), Object.hasOwn(retained, p.name) ? retained[p.name] : p.default));
      const details = node("details"); details.append(node("summary", t("ui.original_settings")));
      const settings = node("div", undefined, "fields"); settings.id = "original-settings-fields";
      const render = (values) => { settings.replaceChildren(); schema.settings.forEach((p) => field(convert(p), settings, Object.hasOwn(values, p.name) ? values[p.name] : p.default)); };
      render(retainedSettings); details.append(settings);
      const actions = node("div", undefined, "actions");
      const save = node("button", t("ui.original_export")); save.type = "button";
      save.addEventListener("click", async () => {
        save.disabled = true;
        try {
          await easy("original/settings", "POST", formValues(settings));
          const link = node("a", t("ui.original_export")); link.href = "/api/easy/original/settings/download"; link.download = "maigret-settings.json";
          actions.querySelector("a")?.remove(); actions.append(link); link.click();
        } catch (error) { notice(error.message); } finally { save.disabled = false; }
      });
      const picker = node("input"); picker.type = "file"; picker.accept = ".json"; picker.hidden = true;
      const load = node("button", t("ui.original_import")); load.type = "button"; load.addEventListener("click", () => picker.click());
      picker.addEventListener("change", async () => {
        load.disabled = true;
        try {
          const file = picker.files[0]; if (!file) return;
          if (file.size > 1024 * 1024) throw Error(t("ui.settings_file_limit"));
          const checked = await easy("original/settings/validate", "POST", JSON.parse(await file.text()));
          if (generation === originalGeneration) { render(checked); notice(t("ui.original_imported")); }
        } catch (error) { notice(error.message); } finally { load.disabled = false; picker.value = ""; }
      });
      actions.append(save, load, picker); details.append(actions); $("#special-fields").append(details);
    } finally { if (generation === originalGeneration) { originalLoading = false; renderPrerequisite(); } }
  }
}
$("#close-dialog").addEventListener("click", () => $("#operation-dialog").close());
$("#operation-dialog").addEventListener("close", () => {
  if ($("#operation-dialog").open) return;
  saveToolDraft(); originalGeneration++;
  $("#operation-form").querySelectorAll('input[type="password"]').forEach((control) => { control.value = ""; });
  (opener?.isConnected ? opener : document.querySelector('nav button[aria-current="page"]'))?.focus();
});
$("#operation-form").addEventListener("submit", async (event) => {
  event.preventDefault(); const button = event.submitter || $("#operation-submit"); button.disabled = true; $("#form-error").hidden = true;
  const operation = selectedTool, generation = originalGeneration;
  try {
    validate($("#operation-form")); postPending = true;
    const values = formValues($("#operation-fields"));
    const special = formValues($("#special-fields"));
    if (operation.id === "credentials-set") await easy("credentials", "POST", { provider: values.provider, value: special.connection_key });
    else if (operation.id === "advanced-analyze") await easy("ai/jobs", "POST", { values, confirmed: special.confirmed === true, api_key: special.api_key || null });
    else if (operation.id === "advanced-maigret") await easy("original/jobs", "POST", { values, settings: formValues($("#original-settings-fields")) });
    else await easy("jobs", "POST", { operation: operation.id, values });
    if (generation === originalGeneration) {
      $("#operation-dialog").close(); toolDrafts.delete(operation.id); $("#operation-fields").replaceChildren(); $("#special-fields").replaceChildren();
      if (operation.id !== "credentials-set") switchScreen("activity");
    }
    notice(t(operation.id === "credentials-set" ? "ui.credentials_saved" : "ui.operation_started")); await refreshJobs(true);
    if (operation.id === "credentials-set") renderSettings();
  } catch (error) {
    if (generation === originalGeneration) { $("#form-error").textContent = error.message; $("#form-error").hidden = false; markError(error, $("#operation-form")); }
    else notice(error.message);
  }
  finally { postPending = false; renderPrerequisite(); }
});
$("#main-search").addEventListener("submit", async (event) => {
  event.preventDefault(); const button = event.submitter || $("#main-search button"); button.disabled = true;
  try {
    validate($("#main-search"));
    await easy("jobs", "POST", { operation: "tools-personal-search", values: { ...formValues($("#search-options")), username: $("#nickname").value.trim().replace(/^@/, ""), mode: $("#main-search input[name=mode]:checked").value } });
    $("#notice").hidden = true; switchScreen("activity"); await refreshJobs(true);
  } catch (error) { notice(error.message); markError(error, $("#main-search")); button.disabled = busy || !ready; }
});
$("#preferences").addEventListener("submit", async (event) => {
  event.preventDefault(); const button = event.submitter || $("#preferences button"); button.disabled = true;
  try { validate($("#preferences")); preferences = await easy("preferences", "PUT", formValues($("#preference-fields"))); notice(t("ui.preferences_saved")); }
  catch (error) { notice(error.message); markError(error, $("#preferences")); }
  finally { button.disabled = false; }
});
async function refreshResults() {
  results = await easy("results");
  const signature = language + JSON.stringify(results);
  if (signature === resultListSnapshot) return;
  resultListSnapshot = signature;
  const root = $("#result-list"); root.replaceChildren();
  if (!results.length) root.append(node("p", t("ui.empty_results"), "empty"));
  results.forEach((row) => {
    const card = node("article", undefined, "card"); card.append(node("h2", row.title), node("p", status(row.status)));
    const button = node("button", t("ui.open_result")); button.addEventListener("click", () => openResult(row).catch((error) => notice(error.message))); card.append(button); root.append(card);
  });
  selections.case = results.map((row) => ({ value: row.path, label: row.title }));
  selections.resume = results.filter((row) => row.kind === "personal").map((row) => ({ value: row.path, label: row.title }));
}
function profileLink(url, label) {
  const fallback = node("span", label);
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) return fallback;
    const link = node("a", label); link.href = parsed.href; link.target = "_blank"; link.rel = "noopener noreferrer"; return link;
  } catch { return fallback; }
}
function accountCard(account) {
  const card = node("article", undefined, "account"); card.append(node("h3", account.handle), profileLink(account.url, account.url));
  const kinds = node("div"); account.match_kinds.forEach((kind) => kinds.append(node("span", t("match." + kind), "badge"))); card.append(kinds);
  const details = node("details"); details.append(node("summary", t("result.evidence")));
  details.append(node("p", account.evidence_ids.join(" · ")), node("p", t("result.attribution")));
  if (account.observed_at) details.append(node("p", t("ui.observed") + ": " + account.observed_at));
  Object.entries(account.public_fields || {}).forEach(([name, value]) => details.append(node("p", name + ": " + value)));
  card.append(details); return card;
}
async function openResult(row, focus = true, retained = {}) {
  selectedResult = row; const generation = ++resultGeneration;
  const root = $("#result-view"); root.hidden = false; root.replaceChildren(node("p", t("ui.loading")));
  const result = await release("results/" + row.id);
  if (generation !== resultGeneration) return;
  if (result.schema_version !== "release-result/1") throw Error(t("error.incompatible_core"));
  resultViews.clear(); root.replaceChildren(node("h2", result.seed), node("p", status(result.job_state)), node("p", t("result.attribution"), "hint"));
  const counts = node("div", undefined, "counts");
  counts.append(node("span", t("result.account_count", { count: result.accounts_total }), "badge"), node("span", t("ui.lead_count", { count: result.leads_total }), "badge")); root.append(counts);
  if (!result.plan_complete) root.append(node("p", t("result.incomplete"), "hint"));
  const downloads = node("div", undefined, "downloads");
  [["personal-report.html", "ui.download_readable"], ["personal-report.md", "ui.download_text"], ["personal-report.json", "ui.download_raw"]].forEach(([file, key]) => {
    const link = node("a", t(key)); link.href = "/api/easy/results/" + row.id + "/download/" + file; link.download = file; downloads.append(link);
  }); root.append(downloads);
  const toolbar = node("div", undefined, "result-toolbar");
  const filter = node("input"); filter.type = "search"; filter.id = "service-filter"; filter.value = retained.filter || ""; const label = node("label", t("ui.filter_services")); label.htmlFor = filter.id;
  const mode = node("select"); mode.setAttribute("aria-label", t("ui.service_view")); mode.append(new Option(t("result.accounts"), "accounts"), new Option(t("ui.all_checks"), "checks"));
  mode.value = retained.mode || "accounts";
  toolbar.append(label, filter, mode); root.append(toolbar);
  const services = node("div", undefined, "services"); root.append(services);
  const empty = node("p", t("ui.no_confirmed_accounts"), "empty"); root.append(empty);
  function applyFilter() {
    let visible = 0;
    resultViews.forEach(({ element, header }) => { element.hidden = !header.name.toLocaleLowerCase().includes(filter.value.toLocaleLowerCase()) || (mode.value === "accounts" && header.confirmed_count === 0); visible += !element.hidden; });
    empty.hidden = visible > 0;
  }
  function appendService(header) {
    if (resultViews.has(header.service_id)) return;
    const element = node("details", undefined, "service"); element.dataset.serviceId = header.service_id;
    element.append(node("summary", header.name + " · " + t("result.account_count", { count: header.confirmed_count })));
    const checks = node("p", Object.entries(header.check_counts).map(([key, count]) => status(key) + ": " + count).join(" · "), "hint"); element.append(checks);
    let loaded = false, cursor = null, pending = false;
    const cards = node("div", undefined, "accounts"); element.append(cards);
    const more = node("button", t("ui.more_accounts")); more.type = "button"; more.hidden = true; element.append(more);
    async function loadPage() {
      if (pending || generation !== resultGeneration) return;
      pending = true; more.disabled = true;
      try {
        const query = cursor ? "?cursor=" + encodeURIComponent(cursor) : "?snapshot=" + result.snapshot;
        const page = await release("results/" + row.id + "/services/" + encodeURIComponent(header.service_id) + "/accounts" + query);
        if (generation !== resultGeneration) return;
        if (page.snapshot !== result.snapshot) throw Error(t("error.projection_unavailable"));
        page.items.forEach((account) => cards.append(accountCard(account)));
        cursor = page.next_cursor; more.hidden = !cursor; loaded = true;
      } catch (error) { notice(error.message); }
      finally { pending = false; more.disabled = false; }
    }
    element.addEventListener("toggle", () => { if (element.open && !loaded && header.confirmed_count > 0) loadPage(); });
    more.addEventListener("click", loadPage);
    resultViews.set(header.service_id, { element, header, loadPage, cards, more }); services.append(element);
  }
  result.services.forEach(appendService); applyFilter(); filter.addEventListener("input", applyFilter); mode.addEventListener("change", applyFilter);
  let servicesCursor = result.services_next_cursor;
  const moreServices = node("button", t("ui.more_services")); moreServices.hidden = !servicesCursor;
  moreServices.addEventListener("click", async () => {
    moreServices.disabled = true;
    try {
      const page = await release("results/" + row.id + "/services?cursor=" + encodeURIComponent(servicesCursor));
      if (generation !== resultGeneration) return;
      if (page.snapshot !== result.snapshot) throw Error(t("error.projection_unavailable"));
      page.items.forEach(appendService); servicesCursor = page.next_cursor; moreServices.hidden = !servicesCursor; applyFilter();
    } catch (error) { notice(error.message); }
    finally { moreServices.disabled = false; }
  }); root.append(moreServices);
  const leads = node("details"); leads.append(node("summary", t("ui.lead_count", { count: result.leads_total })));
  leads.append(node("p", t("recovery.explanation")));
  const leadFilter = node("select"); leadFilter.setAttribute("aria-label", t("recovery.filter"));
  ["all", "profile_unconfirmed", "provider_backoff", "configuration_required", "provider_refused", "invalid_identifier", "work_pending", "retry_exhausted"].forEach((reason) => { const option = node("option", t("recovery.reason." + reason)); option.value = reason; leadFilter.append(option); });
  leads.append(leadFilter);
  const leadList = node("div"); leads.append(leadList);
  const filterLeads = () => { leadList.querySelectorAll("[data-reason]").forEach((element) => { element.hidden = leadFilter.value !== "all" && element.dataset.reason !== leadFilter.value; }); };
  leadFilter.addEventListener("change", filterLeads);
  function appendLeads(items) { items.forEach((lead) => { const reason = lead.reason || "profile_unconfirmed"; const element = node("p", lead.handle + " · " + status(lead.presence_status) + " · " + t(lead.reason_detail ? "recovery.detail." + lead.reason_detail : "recovery.reason." + reason)); element.dataset.reason = reason; if (lead.next_attempt_at) element.append(document.createTextNode(" · " + t("recovery.next_attempt") + ": " + lead.next_attempt_at)); if (lead.url) element.append(document.createTextNode(" · "), profileLink(lead.url, lead.url)); leadList.append(element); }); filterLeads(); }
  appendLeads(result.leads); let leadsCursor = result.leads_next_cursor;
  const moreLeads = node("button", t("ui.more_leads")); moreLeads.hidden = !leadsCursor;
  moreLeads.addEventListener("click", async () => {
    moreLeads.disabled = true;
    try {
      const page = await release("results/" + row.id + "/leads?cursor=" + encodeURIComponent(leadsCursor));
      if (generation !== resultGeneration) return;
      if (page.snapshot !== result.snapshot) throw Error(t("error.projection_unavailable"));
      appendLeads(page.items); leadsCursor = page.next_cursor; moreLeads.hidden = !leadsCursor;
    } catch (error) { notice(error.message); }
    finally { moreLeads.disabled = false; }
  }); leads.append(moreLeads); root.append(leads);
  const summary = node("details"); summary.append(node("summary", t("result.checks")), node("p", Object.entries(result.check_summary).map(([key, count]) => status(key) + ": " + count).join(" · ")));
  summary.append(node("p", t("ui.coverage", { checked: result.coverage.checked, pending: result.coverage.pending, excluded: result.coverage.excluded }))); root.append(summary);
  for (const [id, count] of Object.entries(retained.open || {})) {
    const view = resultViews.get(id); if (!view) continue;
    do { await view.loadPage(); } while (generation === resultGeneration && view.cards.children.length < count && !view.more.hidden);
    if (generation !== resultGeneration) return;
    view.element.open = true;
  }
  if (focus) root.focus();
}
function resultState() {
  return {
    filter: $("#service-filter")?.value,
    mode: $(".result-toolbar select")?.value,
    open: Object.fromEntries([...resultViews].filter(([, view]) => view.element.open).map(([id, view]) => [id, view.cards.children.length])),
  };
}
async function openOutput(row, button) {
  const generation = ++outputGeneration; outputOpener = button;
  const dialog = $("#output-dialog"); dialog.showModal(); $("#output-text").textContent = t("ui.loading");
  $("#output-identifiers").replaceChildren(); $("#download-output").disabled = true;
  try {
    const output = await release("jobs/" + row.id + "/output");
    if (!dialog.open || generation !== outputGeneration) return;
    $("#output-text").textContent = output.text || t("ui.output_empty");
    $("#output-truncated").hidden = !output.truncated;
    const download = $("#download-output");
    download.disabled = false;
    // Match only UUIDs and offer existing named records; arbitrary output stays text.
    const saved = await easy("selections");
    if (!dialog.open || generation !== outputGeneration) return;
    (saved.investigation_id || []).filter((item) => output.text.includes(item.value)).forEach((item) => {
      const card = node("div", undefined, "output-record"); card.append(node("b", item.label), node("code", item.value));
      const details = toolAction("investigation-show", "ui.investigation_details", { investigation_id: item.value });
      details.addEventListener("click", () => dialog.close()); card.append(details); $("#output-identifiers").append(card);
    });
    download.onclick = () => {
      const url = URL.createObjectURL(new Blob([output.text], { type: "text/plain;charset=utf-8" }));
      const link = node("a"); link.href = url; link.download = "tool-output.txt"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
  } catch (error) { if (generation === outputGeneration && dialog.open) $("#output-text").textContent = error.message; }
}
$("#output-dialog").addEventListener("close", () => { outputGeneration++; $("#output-text").textContent = ""; $("#download-output").onclick = null; if (outputOpener?.isConnected && !$("#operation-dialog").open) outputOpener.focus(); });
$("#close-output").addEventListener("click", () => $("#output-dialog").close());
async function refreshJobs(force = false) {
  if (jobRefresh) return jobRefresh;
  jobRefresh = (async () => {
    const rows = await release("jobs");
    const signature = JSON.stringify([historyLimit, [...pendingJobActions], rows.map((row) => [row.id, row.state, row.progress.stage, row.progress.checked, row.progress.planned, Math.floor(row.progress.elapsed_seconds / 60), row.resumable])]);
    busy = rows.some((row) => ["RUNNING", "QUEUED"].includes(row.state));
    $("#main-search button").disabled = busy || !ready;
    updateRunState(); if ($("#operation-dialog").open) renderPrerequisite();
    let finished = false;
    rows.forEach((row) => { const previous = knownJobStates.get(row.id); if (previous && ["RUNNING", "QUEUED"].includes(previous) && !["RUNNING", "QUEUED"].includes(row.state)) finished = true; knownJobStates.set(row.id, row.state); });
    if (finished) await refreshWorkspace();
    if (!force && signature === jobSnapshot) return;
    jobSnapshot = signature; const root = $("#job-list");
    const focused = document.activeElement?.closest("[data-job-action]");
    const focusKey = focused?.dataset.jobAction; root.replaceChildren(); $("#activity").hidden = !rows.length;
    $("#activity-empty").hidden = !!rows.length; $("#more-jobs").hidden = rows.length <= historyLimit;
    rows.slice(0, historyLimit).forEach((row) => {
      const element = node("article", undefined, "job");
      element.append(node("b", catalog.find((operation) => operation.id === row.operation)?.title || t("ui.operation")), node("span", status(row.state), "badge"));
      element.append(node("p", new Date(row.created_at).toLocaleString(language), "hint"));
      const progress = row.progress;
      if (row.state === "RUNNING") {
        if (progress.stage) element.append(node("p", t("ui.stage_" + progress.stage)));
        element.append(node("p", t("ui.progress", { checked: progress.checked, planned: progress.planned, minutes: Math.floor(progress.elapsed_seconds / 60) })));
      }
      const actions = node("div", undefined, "actions");
      const action = (name, label, callback) => { const button = node("button", t(label)); button.dataset.jobAction = row.id + ":" + name; button.disabled = pendingJobActions.has(row.id); button.addEventListener("click", () => callback(button)); actions.append(button); return button; };
      if (["RUNNING", "QUEUED"].includes(row.state)) {
        action("stop", "action.stop", (button) => jobAction(row.id, "stop", button));
      } else if (row.resumable) {
        const resume = action("resume", "action.continue", (button) => jobAction(row.id, "resume", button)); resume.disabled ||= busy;
      }
      if (row.report_id && !["QUEUED", "RUNNING"].includes(row.state)) {
        const open = node("button", t("ui.open_result")); open.addEventListener("click", () => { switchScreen("results"); openResult({ id: row.report_id, title: t("nav.results") }).catch((error) => notice(error.message)); }); actions.append(open);
      }
      if (row.state === "FAILED") element.append(node("p", t("error.generic"), "error"));
      if (!["QUEUED", "RUNNING"].includes(row.state) && row.operation !== "tools-personal-search") {
        action("output", "ui.view_output", (button) => openOutput(row, button));
      }
      element.append(actions); root.append(element);
    });
    if (focusKey && !$("dialog[open]")) [...root.querySelectorAll("[data-job-action]")].find((button) => button.dataset.jobAction === focusKey)?.focus({ preventScroll: true });
    await refreshResults();
  })();
  try { await jobRefresh; } finally { jobRefresh = null; }
}
async function jobAction(id, action, button) {
  if (pendingJobActions.has(id)) return; pendingJobActions.add(id); button.disabled = true;
  try { await easy("jobs/" + id + "/" + action, "POST", {}); await refreshJobs(true); }
  catch (error) { notice(error.message); button.disabled = false; }
  finally { pendingJobActions.delete(id); await refreshJobs(true).catch((error) => notice(error.message)); }
}
$("#more-jobs").addEventListener("click", () => { historyLimit += 12; refreshJobs(true).catch((error) => notice(error.message)); });
$("#refresh-activity").addEventListener("click", () => refreshJobs(true).catch((error) => notice(error.message)));
$("#retry-connection").addEventListener("click", () => location.reload());
$("#language").addEventListener("change", async (event) => {
  const control = event.target, restoreFocus = document.activeElement === control; control.disabled = true;
  const searchValues = formValues($("#search-options"), true), savedValues = formValues($("#preference-fields"), true);
  const toolValues = formValues($("#operation-fields"), true), special = formValues($("#special-fields"), true);
  const originalSettings = $("#original-settings-fields") ? formValues($("#original-settings-fields"), true) : {};
  const retained = resultState(), scroll = window.scrollY;
  try {
    const result = await easy("language", "PUT", { language: control.value });
    language = result.language; messages = result.messages;
    const response = await release("catalog"); catalog = response.operations;
    localizePage(); renderSettings(searchValues, savedValues); renderTools();
    if ($("#operation-dialog").open) {
      opener = document.querySelector('[data-operation-id="' + selectedTool.id + '"]');
      await openTool(catalog.find((operation) => operation.id === selectedTool.id), null, toolValues, special, originalSettings);
    }
    await refreshWorkspace(); await refreshJobs(true);
    if (selectedResult) await openResult(selectedResult, false, retained);
    window.scrollTo(0, scroll);
  } catch (error) { notice(error.message); control.value = language; }
  finally { control.disabled = false; if (restoreFocus && !$("#operation-dialog").open) control.focus({ preventScroll: true }); }
});
async function init() {
  const locale = await easy("language"); language = locale.language; messages = locale.messages;
  const [response, defaults] = await Promise.all([release("catalog"), easy("preferences")]);
  if (response.schema_version !== "release-catalog/1") throw Error(t("error.incompatible_core"));
  catalog = response.operations; preferences = defaults; selections = {};
  localizePage(); renderSettings(); renderTools();
  if (preferences.mode) $("#main-search input[value=" + preferences.mode + "]").checked = true;
  await refreshWorkspace(); ready = true; await refreshJobs(true); await refreshResults();
  setInterval(() => refreshJobs().catch((error) => notice(error.message)), 2500);
}
init().catch((error) => notice(error.message));
