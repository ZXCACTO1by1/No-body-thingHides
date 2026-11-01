"use strict";
const $ = (selector) => document.querySelector(selector);
let language = "en", messages = {}, catalog = [], preferences = {}, results = [], selections = {};
let screen = "search", busy = false, selectedTool = null, selectedResult = null;
let resultGeneration = 0, jobRefresh = null, jobSnapshot = "", opener = null;
let originalGeneration = 0;
let resultListSnapshot = "";
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
function notice(message) { $("#notice").textContent = message; $("#notice").hidden = false; }
function status(value) { return messages["status." + value] || t("ui.state_details"); }
async function request(path, method = "GET", body) {
  const options = { method, headers: { "X-NBTH-Token": TOKEN } };
  if (body !== undefined) { options.headers["Content-Type"] = "application/json"; options.body = JSON.stringify(body); }
  let response, value;
  try { response = await fetch(path, options); value = await response.json(); }
  catch { throw Error(t("ui.connection_error")); }
  if (!response.ok) {
    const keys = { INVALID_REQUEST: "error.invalid_input", RELEASE_UNAVAILABLE: "error.release_unavailable", SESSION_REQUIRED: "error.session_required", RESULT_NOT_FOUND: "error.result_not_found", PROJECTION_UNAVAILABLE: "error.projection_unavailable", INCOMPATIBLE_SCHEMA: "error.incompatible_core" };
    throw Error(t(keys[value.code] || "error.generic"));
  }
  return value;
}
const easy = (path, method, body) => request("/api/easy/" + path, method, body);
const release = (path) => request("/api/release/v1/" + path);
function localizePage() {
  document.documentElement.lang = language;
  $("#language").value = language;
  document.querySelectorAll("[data-i18n]").forEach((element) => { element.textContent = t(element.dataset.i18n); });
  $("#close-dialog").setAttribute("aria-label", t("action.close"));
  document.querySelector("nav").setAttribute("aria-label", t("ui.navigation"));
}
function switchScreen(name, focus = true) {
  if (!["search", "results", "tools", "settings"].includes(name)) return;
  screen = name;
  document.querySelectorAll("[id^=screen-]").forEach((section) => { section.hidden = section.id !== "screen-" + name; });
  document.querySelectorAll("nav button").forEach((button) => {
    if (button.dataset.screen === name) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  if (focus) $("#content").focus();
}
document.querySelectorAll("nav button").forEach((button) => button.addEventListener("click", () => switchScreen(button.dataset.screen)));
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
  const choices = parameter.choices || [];
  const saved = selections[parameter.name];
  if (parameter.kind === "choice" || (choices.length && !parameter.multiple) || saved?.length) {
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
  if (control.type === "number") control.step = "any";
  const label = node("label", parameter.label); label.htmlFor = control.id;
  const hint = node("small", parameter.help || ""); hint.id = control.id + "-hint";
  control.setAttribute("aria-describedby", hint.id);
  box.append(label, control, hint);
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
        control.value = parameter.multiple ? paths.join("\n") : paths[0] || "";
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
}
function renderTools() {
  const root = $("#tool-list"); root.replaceChildren();
  catalog.filter((operation) => !["tools-personal-search", "tools-easy-web"].includes(operation.id)).forEach((operation) => {
    const card = node("article", undefined, "card"); card.dataset.filter = (operation.title + " " + operation.description).toLocaleLowerCase();
    card.append(node("h2", operation.title), node("p", operation.description));
    const button = node("button", t("ui.open_tool")); button.dataset.operationId = operation.id;
    button.addEventListener("click", () => openTool(operation, button).catch((error) => notice(error.message))); card.append(button); root.append(card);
  });
  filterTools();
}
function filterTools() {
  const query = $("#tool-filter").value.toLocaleLowerCase();
  $("#tool-list").querySelectorAll(".card").forEach((card) => { card.hidden = !card.dataset.filter.includes(query); });
}
$("#tool-filter").addEventListener("input", filterTools);
async function openTool(operation, button, retained = {}, special = {}, retainedSettings = {}) {
  selectedTool = operation; if (button) opener = button;
  const generation = ++originalGeneration;
  $("#operation-title").textContent = operation.title; $("#operation-help").textContent = operation.description;
  $("#operation-fields").replaceChildren(); $("#special-fields").replaceChildren(); $("#form-error").hidden = true;
  if (operation.id !== "advanced-maigret") operation.parameters.filter((parameter) => !["home", "database_url"].includes(parameter.name)).forEach((parameter) => field(parameter, $("#operation-fields"), Object.hasOwn(retained, parameter.name) ? retained[parameter.name] : parameter.default));
  if (operation.id === "credentials-set") field({ name: "connection_key", kind: "text", secret: true, required: true, label: t("ui.connection_key"), help: t("ui.key_hint") }, $("#special-fields"), special.connection_key);
  if (operation.id === "advanced-analyze") {
    $("#special-fields").append(node("p", t("ui.analysis_confirmation"), "hint"));
    field({ name: "api_key", kind: "text", secret: true, label: t("ui.ephemeral_key"), help: t("ui.ephemeral_hint") }, $("#special-fields"), special.api_key);
    field({ name: "confirmed", kind: "boolean", label: t("ui.confirm_send"), help: "" }, $("#special-fields"), special.confirmed === true);
  }
  if (!$("#operation-dialog").open) $("#operation-dialog").showModal();
  if (operation.id === "advanced-maigret") {
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
    } finally { if (generation === originalGeneration) $("#operation-form > button").disabled = false; }
  }
}
$("#close-dialog").addEventListener("click", () => $("#operation-dialog").close());
$("#operation-dialog").addEventListener("close", () => { originalGeneration++; opener?.focus(); });
$("#operation-form").addEventListener("submit", async (event) => {
  event.preventDefault(); const button = event.submitter; button.disabled = true; $("#form-error").hidden = true;
  try {
    const values = formValues($("#operation-fields"));
    const special = formValues($("#special-fields"));
    if (selectedTool.id === "credentials-set") await easy("credentials", "POST", { provider: values.provider, value: special.connection_key });
    else if (selectedTool.id === "advanced-analyze") await easy("ai/jobs", "POST", { values, confirmed: special.confirmed === true, api_key: special.api_key || null });
    else if (selectedTool.id === "advanced-maigret") await easy("original/jobs", "POST", { values, settings: formValues($("#original-settings-fields")) });
    else await easy("jobs", "POST", { operation: selectedTool.id, values });
    $("#operation-dialog").close(); $("#operation-fields").replaceChildren(); $("#special-fields").replaceChildren(); switchScreen("search"); notice(t("ui.operation_started")); await refreshJobs(true);
  } catch (error) { $("#form-error").textContent = error.message; $("#form-error").hidden = false; }
  finally { button.disabled = false; }
});
$("#main-search").addEventListener("submit", async (event) => {
  event.preventDefault(); event.submitter.disabled = true;
  try {
    await easy("jobs", "POST", { operation: "tools-personal-search", values: { ...formValues($("#search-options")), username: $("#nickname").value.trim().replace(/^@/, ""), mode: $("#main-search input[name=mode]:checked").value } });
    $("#notice").hidden = true; await refreshJobs(true);
  } catch (error) { notice(error.message); event.submitter.disabled = busy; }
});
$("#preferences").addEventListener("submit", async (event) => {
  event.preventDefault(); event.submitter.disabled = true;
  try { preferences = await easy("preferences", "PUT", formValues($("#preference-fields"))); notice(t("ui.preferences_saved")); }
  catch (error) { notice(error.message); }
  finally { event.submitter.disabled = false; }
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
  const leadList = node("div"); leads.append(leadList);
  function appendLeads(items) { items.forEach((lead) => { const element = node("p", lead.handle + " · " + status(lead.presence_status)); if (lead.url) element.append(document.createTextNode(" · "), profileLink(lead.url, lead.url)); leadList.append(element); }); }
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
  const dialog = $("#output-dialog"); dialog.showModal(); $("#output-text").textContent = t("ui.loading");
  try {
    const output = await release("jobs/" + row.id + "/output");
    $("#output-text").textContent = output.text || t("ui.output_empty");
    $("#output-truncated").hidden = !output.truncated;
    const download = $("#download-output");
    download.onclick = () => {
      const url = URL.createObjectURL(new Blob([output.text], { type: "text/plain;charset=utf-8" }));
      const link = node("a"); link.href = url; link.download = "tool-output.txt"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
  } catch (error) { $("#output-text").textContent = error.message; }
  dialog.onclose = () => { $("#output-text").textContent = ""; $("#download-output").onclick = null; if (button.isConnected) button.focus(); };
}
$("#close-output").addEventListener("click", () => $("#output-dialog").close());
async function refreshJobs(force = false) {
  if (jobRefresh) return jobRefresh;
  jobRefresh = (async () => {
    const rows = await release("jobs");
    const signature = JSON.stringify(rows.map((row) => [row.id, row.state, row.progress.stage, row.progress.checked, row.progress.planned, Math.floor(row.progress.elapsed_seconds / 60), row.resumable]));
    busy = rows.some((row) => ["RUNNING", "QUEUED"].includes(row.state));
    $("#main-search button").disabled = busy;
    if (!force && signature === jobSnapshot) return;
    jobSnapshot = signature; const root = $("#job-list"); root.replaceChildren(); $("#activity").hidden = !rows.length;
    rows.slice(0, 12).forEach((row) => {
      const element = node("article", undefined, "job");
      element.append(node("b", catalog.find((operation) => operation.id === row.operation)?.title || t("ui.operation")), node("span", status(row.state), "badge"));
      const progress = row.progress;
      if (row.state === "RUNNING") {
        if (progress.stage) element.append(node("p", t("ui.stage_" + progress.stage)));
        element.append(node("p", t("ui.progress", { checked: progress.checked, planned: progress.planned, minutes: Math.floor(progress.elapsed_seconds / 60) })));
      }
      const actions = node("div", undefined, "actions");
      if (["RUNNING", "QUEUED"].includes(row.state)) {
        const stop = node("button", t("action.stop")); stop.addEventListener("click", () => jobAction(row.id, "stop", stop)); actions.append(stop);
      } else if (row.resumable) {
        const resume = node("button", t("action.continue")); resume.disabled = busy; resume.addEventListener("click", () => jobAction(row.id, "resume", resume)); actions.append(resume);
      }
      if (row.report_id && !["QUEUED", "RUNNING"].includes(row.state)) {
        const open = node("button", t("ui.open_result")); open.addEventListener("click", () => { switchScreen("results"); openResult({ id: row.report_id, title: t("nav.results") }).catch((error) => notice(error.message)); }); actions.append(open);
      }
      if (row.state === "FAILED") element.append(node("p", t("error.generic"), "error"));
      if (!["QUEUED", "RUNNING"].includes(row.state) && row.operation !== "tools-personal-search") {
        const output = node("button", t("ui.view_output")); output.addEventListener("click", () => openOutput(row, output)); actions.append(output);
      }
      element.append(actions); root.append(element);
    });
    await refreshResults();
  })();
  try { await jobRefresh; } finally { jobRefresh = null; }
}
async function jobAction(id, action, button) {
  button.disabled = true;
  try { await easy("jobs/" + id + "/" + action, "POST", {}); await refreshJobs(true); }
  catch (error) { notice(error.message); button.disabled = false; }
}
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
    await refreshJobs(true);
    if (selectedResult) await openResult(selectedResult, false, retained);
    window.scrollTo(0, scroll);
  } catch (error) { notice(error.message); control.value = language; }
  finally { control.disabled = false; if (restoreFocus && !$("#operation-dialog").open) control.focus({ preventScroll: true }); }
});
async function init() {
  const locale = await easy("language"); language = locale.language; messages = locale.messages;
  const [response, defaults, saved] = await Promise.all([release("catalog"), easy("preferences"), easy("selections")]);
  if (response.schema_version !== "release-catalog/1") throw Error(t("error.incompatible_core"));
  catalog = response.operations; preferences = defaults; selections = saved;
  localizePage(); renderSettings(); renderTools();
  if (preferences.mode) $("#main-search input[value=" + preferences.mode + "]").checked = true;
  await refreshJobs(true); await refreshResults();
  setInterval(() => refreshJobs().catch((error) => notice(error.message)), 2500);
}
init().catch((error) => notice(error.message));
