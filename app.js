const pageTitles = {
  dashboard: "Dashboard operacional",
  fleet: "Base de frotas",
  collections: "Programacao de coletas",
  results: "Resultados das analises",
};

const supabaseUrl = "https://xgfxsvvypffmibyuhdrd.supabase.co";
const supabasePublishableKey = "sb_publishable_hyItLlFEiF9BFn9JNxtj9A_48NwLfeX";
const supabaseClient = window.supabase?.createClient(supabaseUrl, supabasePublishableKey);
const internalLoginDomain = "sistema.local";
const userRoles = {
  "admin@teste.com": "admin",
  "user@sistema.local": "coletor",
};
const fleetCsvPath = "database/base_frotas.csv";
const analysisCsvPath = "database/analises_chb.csv";
let collectionsByDay = [];
let riskByComponent = [];
let priorities = [];
let resultDistribution = [];
let analyses = [];
let filteredAnalyses = [];
let reportResultDetails = {};
let activeReportKey = "default";
let scheduleView = "week";
let scheduleAnchor = new Date();
let selectedScheduleDate = "";
let selectedServiceId = null;
let scheduleDbEnabled = false;
let currentUserRole = "coletor";
let batchEndDateTouched = false;
const scheduleItems = [
  { id: 1, date: "2026-05-04", fleet: "60102", compartment: "CARTER MOTOR", done: true },
  { id: 2, date: "2026-05-04", fleet: "62279", compartment: "CARTER MOTOR", done: false },
  { id: 3, date: "2026-05-05", fleet: "62515", compartment: "CARTER MOTOR", done: true },
  { id: 4, date: "2026-05-06", fleet: "62212", compartment: "CARTER MOTOR", done: false },
  { id: 5, date: "2026-05-06", fleet: "60906", compartment: "CARTER MOTOR", done: false },
  { id: 6, date: "2026-05-07", fleet: "62200", compartment: "CARTER MOTOR", done: true },
  { id: 7, date: "2026-05-08", fleet: "62228", compartment: "CARTER MOTOR", done: false },
  { id: 8, date: "2026-05-11", fleet: "62521", compartment: "CAIXA PICADOR", done: false },
  { id: 9, date: "2026-05-13", fleet: "64202", compartment: "CARTER MOTOR", done: false },
  { id: 10, date: "2026-05-15", fleet: "60818", compartment: "CARTER MOTOR", done: true },
  { id: 11, date: "2026-05-20", fleet: "62246", compartment: "TRANSMISSAO", done: false },
  { id: 12, date: "2026-05-25", fleet: "62517", compartment: "CAIXA CAMBIO", done: false },
];
let nextScheduleId = Math.max(...scheduleItems.map((item) => item.id)) + 1;

let fleet = [
  {
    codigo: "36700",
    especialidade: "REBOQUE - CANAVIEIRO",
    agrupamento: "REBOQUE",
    descricao: "SEMI REBOQUE RANDON SR CP 0228 AAA-9999",
    risco: "Normal",
  },
  {
    codigo: "36701",
    especialidade: "REBOQUE - CANAVIEIRO",
    agrupamento: "REBOQUE",
    descricao: "REBOQUE RANDON RQ CP HI 0435 AAA-9999",
    risco: "Normal",
  },
  {
    codigo: "36708",
    especialidade: "REBOQUE - CANAVIEIRO",
    agrupamento: "REBOQUE",
    descricao: "REBOQUE MGS MNJ-6587",
    risco: "Atencao",
  },
];

function tagFor(status) {
  const key = status === "Critico" ? "danger" : status === "Atencao" ? "warning" : "ok";
  return `<span class="tag ${key}">${status}</span>`;
}

function renderChart() {
  const chart = document.querySelector("#collection-chart");
  if (!collectionsByDay.length) {
    chart.innerHTML = `<div class="empty-state">Sem dados de coleta no relatorio.</div>`;
    return;
  }

  const max = Math.max(...collectionsByDay.map((item) => item.count));
  chart.innerHTML = collectionsByDay
    .map((item) => {
      const height = Math.max(18, Math.round((item.count / max) * 210));
      return `<div class="bar" title="${item.date}" style="height:${height}px"><span>${item.count}</span></div>`;
    })
    .join("");
}

function renderRisks() {
  const list = document.querySelector("#risk-list");
  if (!riskByComponent.length) {
    list.innerHTML = `<div class="empty-state">Sem analises criticas no relatorio.</div>`;
    return;
  }

  list.innerHTML = riskByComponent
    .map(
      (item) => `
        <div class="risk-item">
          <div class="risk-meta"><strong>${item.name}</strong><span>${item.count}</span></div>
          <div class="track"><div class="fill" style="width:${item.value}%"></div></div>
        </div>
      `
    )
    .join("");
}

function renderPriorities() {
  const table = document.querySelector("#priority-table");
  if (!priorities.length) {
    table.innerHTML = `<tr><td colspan="5">Sem analises criticas no relatorio.</td></tr>`;
    return;
  }

  table.innerHTML = priorities
    .map(
      (row) => `
        <tr>
          <td><strong>${row.cod_frota}</strong></td>
          <td>${row.compartimento}</td>
          <td>${row.resultado}</td>
          <td>${formatDate(row.data_coleta)}</td>
          <td>${tagFor(row.classificacao)}</td>
        </tr>
      `
    )
    .join("");
}

function renderResultDistribution() {
  const list = document.querySelector("#result-distribution");
  if (!resultDistribution.length) {
    list.innerHTML = `<div class="empty-state">Sem resultados no periodo selecionado.</div>`;
    return;
  }

  list.innerHTML = resultDistribution
    .map(
      (item) => `
        <div class="risk-item">
          <div class="risk-meta"><strong>${item.name}</strong><span>${item.count}</span></div>
          <div class="track"><div class="fill ${item.className}" style="width:${item.value}%"></div></div>
        </div>
      `
    )
    .join("");
}

function parseCsvLine(line, delimiter) {
  const values = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === `"` && quoted && next === `"`) {
      current += char;
      index += 1;
    } else if (char === `"`) {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const firstLine = lines.shift().replace(/^\uFEFF/, "");
  const delimiter = firstLine.includes(";") ? ";" : ",";
  const headers = parseCsvLine(firstLine, delimiter).map((header) => header.trim());

  return lines.map((line) => {
    const values = parseCsvLine(line, delimiter);
    return headers.reduce((record, header, index) => {
      record[header] = values[index] || "";
      return record;
    }, {});
  });
}

function inferRisk(record) {
  const code = Number(record.CodFrota || record.cod_frota || record.codigo || 0);
  if (code % 41 === 0) return "Critico";
  if (code % 17 === 0) return "Atencao";
  return "Normal";
}

function normalizeFleetRecord(record) {
  return {
    codigo: record.CodFrota || record.cod_frota || record.codigo || "-",
    especialidade: record.descricao_especialidade || record.especialidade || "-",
    agrupamento: record.descricao_especialidadeAgrup || record.descricao_especialidade_agrup || record.agrupamento || "-",
    descricao: record.descricao_frota || record.descricao || "-",
    risco: inferRisk(record),
  };
}

function classifyAnalysis(result) {
  const normalized = (result || "").toUpperCase();
  if (normalized.includes("CRITICO") || normalized.includes("CRÍTICO")) return "Critico";
  if (!normalized || normalized === "NORMAL") return "Normal";
  return "Atencao";
}

function formatDate(dateText) {
  if (!dateText) return "-";
  const [year, month, day] = dateText.split("-");
  if (!year || !month || !day) return dateText;
  return `${day}/${month}/${year}`;
}

function toDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function nextAllowedDate(date, weekdays) {
  let cursor = new Date(date);
  while (!weekdays.includes(cursor.getDay())) {
    cursor = addDays(cursor, 1);
  }
  return cursor;
}

function allowedDatesInRange(startDate, endDate, weekdays) {
  const sortedWeekdays = [...weekdays].sort((a, b) => a - b);
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  const dates = [];
  let cursor = nextAllowedDate(start, sortedWeekdays);

  while (cursor <= end) {
    dates.push(toDateKey(cursor));
    cursor = nextAllowedDate(addDays(cursor, 1), sortedWeekdays);
  }

  return dates;
}

function distributeFleetsAcrossWeekdays(fleets, startDate, endDate, weekdays) {
  const dates = allowedDatesInRange(startDate, endDate, weekdays);
  if (!dates.length) return [];

  const buckets = dates.map((date) => ({ date, count: 0 }));

  return fleets.map((fleetCode) => {
    buckets.sort((a, b) => {
      if (a.count !== b.count) return a.count - b.count;
      return a.date.localeCompare(b.date);
    });

    const target = buckets[0];
    target.count += 1;
    return { fleetCode, date: target.date };
  });
}

function startOfWeek(date) {
  const start = new Date(date);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthName(date) {
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function renderScheduleItem(item) {
  const status = item.done ? "REALIZADA" : "PENDENTE";
  const resultLabel = item.result ? `<em>${item.result}</em>` : "";
  return `
    <button class="service-card ${item.done ? "done" : ""}" type="button" data-service-id="${item.id}">
      <div class="service-card-top">
        <strong>${item.fleet}</strong>
        <span>${status}</span>
      </div>
      <b>ANALISE DE OLEO</b>
      <small>${item.compartment}</small>
      ${resultLabel}
    </button>
  `;
}

function progressClass(percent, total) {
  if (!total) return "empty";
  if (percent >= 100) return "complete";
  if (percent >= 50) return "partial";
  return "low";
}

function renderWeekSchedule() {
  const grid = document.querySelector("#schedule-grid");
  const start = startOfWeek(scheduleAnchor);
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));
  const end = days[6];

  document.querySelector("#schedule-period-label").textContent = `${formatDate(toDateKey(start))} a ${formatDate(toDateKey(end))}`;
  grid.className = "schedule-grid week-view";
  grid.innerHTML = days
    .map((date) => {
      const key = toDateKey(date);
      const items = scheduleItems.filter((item) => item.date === key);
      const done = items.filter((item) => item.done).length;
      const percent = items.length ? Math.round((done / items.length) * 100) : 0;
      return `
        <article class="schedule-day ${progressClass(percent, items.length)}" data-schedule-date="${key}">
          <div class="schedule-day-liquid">
            <div class="day-fill" style="height:${percent}%"></div>
            <div class="liquid-wave" style="--fill-level:${percent}%"></div>
            <div class="schedule-day-header">
              <strong>${date.toLocaleDateString("pt-BR", { weekday: "short" })}</strong>
              <span>${formatDate(key)}</span>
            </div>
            <div class="schedule-progress-text">${done}/${items.length || 0} realizados</div>
          </div>
          <div class="schedule-list">
            ${items.length ? items.map(renderScheduleItem).join("") : `<div class="empty-state">Sem coletas</div>`}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderMonthSchedule() {
  const grid = document.querySelector("#schedule-grid");
  const first = startOfMonth(scheduleAnchor);
  const calendarStart = startOfWeek(first);
  const days = Array.from({ length: 42 }, (_, index) => addDays(calendarStart, index));

  document.querySelector("#schedule-period-label").textContent = monthName(scheduleAnchor);
  grid.className = "schedule-grid month-view";
  grid.innerHTML = days
    .map((date) => {
      const key = toDateKey(date);
      const items = scheduleItems.filter((item) => item.date === key);
      const done = items.filter((item) => item.done).length;
      const percent = items.length ? Math.round((done / items.length) * 100) : 0;
      const outside = date.getMonth() !== scheduleAnchor.getMonth();
      return `
        <article class="month-day ${outside ? "outside-month" : ""} ${progressClass(percent, items.length)}" data-schedule-date="${key}">
          <div class="day-fill" style="height:${percent}%"></div>
          <div class="liquid-wave" style="--fill-level:${percent}%"></div>
          <div class="month-day-content">
            <div class="month-day-header">
              <strong>${date.getDate()}</strong>
              <span>${done}/${items.length || 0}</span>
            </div>
            <div class="month-day-list">
              ${items.slice(0, 3).map(renderScheduleItem).join("")}
              ${items.length > 3 ? `<small>+${items.length - 3} coletas</small>` : ""}
              ${items.length ? `<button class="month-open-button" type="button">Ver dia</button>` : ""}
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderSchedule() {
  if (scheduleView === "week") {
    renderWeekSchedule();
  } else {
    renderMonthSchedule();
  }
}

function openScheduleModal(dateKey) {
  selectedScheduleDate = dateKey;
  const modal = document.querySelector("#schedule-modal");
  const title = document.querySelector("#schedule-modal-title");
  const subtitle = document.querySelector("#schedule-modal-subtitle");
  const list = document.querySelector("#modal-task-list");
  const items = scheduleItems.filter((item) => item.date === dateKey);
  const done = items.filter((item) => item.done).length;

  title.textContent = `Servicos de ${formatDate(dateKey)}`;
  subtitle.textContent = `${done}/${items.length || 0} realizados`;
  list.innerHTML = items.length
    ? items
        .map(
          (item) => `
            <div class="modal-task ${item.done ? "done" : ""}">
              ${renderScheduleItem(item)}
              <button class="danger-button" type="button" data-delete-schedule-id="${item.id}">Excluir</button>
            </div>
          `
        )
        .join("")
    : `<div class="empty-state">Nenhum servico agendado para este dia.</div>`;

  if (!modal.open) {
    modal.showModal();
  }
}

function openServiceModal(id) {
  const item = scheduleItems.find((entry) => entry.id === id);
  if (!item) return;
  selectedServiceId = id;

  document.querySelector("#service-fleet-code").textContent = item.fleet;
  document.querySelector("#service-compartment").value = item.compartment;
  document.querySelector("#service-status").value = item.done ? "Realizada" : "Pendente";
  document.querySelector("#service-result").value = item.result || "";
  document.querySelector("#service-completion-date").value = item.completionDate || item.date;
  document.querySelector("#service-location").value = item.location || "Base (Oficina)";
  document.querySelector("#service-modal").showModal();
}

function getBatchFormData() {
  const startDate = document.querySelector("#batch-start-date").value;
  const endDate = document.querySelector("#batch-end-date").value;
  const compartment = document.querySelector("#batch-compartment").value.trim();
  const fleets = [...new Set(
    document.querySelector("#batch-fleets").value
      .split(/\r?\n|,|;/)
      .map((item) => item.trim())
      .filter(Boolean)
  )];
  const weekdays = [...document.querySelectorAll(".weekday-picker input:checked")].map((input) => Number(input.value));
  return { startDate, endDate, compartment, fleets, weekdays };
}

function updateBatchPreview() {
  const preview = document.querySelector("#batch-preview");
  const { startDate, endDate, fleets, weekdays } = getBatchFormData();
  if (!startDate || !endDate || !fleets.length || !weekdays.length) {
    preview.textContent = "Informe periodo, lista de frotas e dias para ver a previa.";
    return;
  }

  if (endDate < startDate) {
    preview.textContent = "A data final deve ser maior ou igual a data inicial.";
    return;
  }

  const availableDates = allowedDatesInRange(startDate, endDate, weekdays);
  if (!availableDates.length) {
    preview.textContent = "Nao ha dias selecionados dentro do periodo informado.";
    return;
  }

  const distribution = distributeFleetsAcrossWeekdays(fleets, startDate, endDate, weekdays);
  const grouped = distribution.reduce((summary, item) => {
    summary[item.date] = (summary[item.date] || 0) + 1;
    return summary;
  }, {});

  const warning = fleets.length > availableDates.length ? `<em>${fleets.length} frotas em ${availableDates.length} dia(s); havera mais de uma frota por dia.</em>` : "";
  preview.innerHTML = `${warning}${Object.entries(grouped)
    .map(([date, count]) => `<span><strong>${formatDate(date)}</strong>${count} frota(s)</span>`)
    .join("")}`;
}

function isActionableResult(item) {
  return item.result === "Anomalia" || item.result === "Critico";
}

function isReportAnomaly(item) {
  return item.classificacao === "Critico" || item.classificacao === "Atencao";
}

function reportResultId(item, index) {
  return `${activeReportKey}-${item.cod_frota}-${item.data_coleta}-${item.compartimento}-${index}`.replace(/\s+/g, "-");
}

function getUnifiedResults() {
  const scheduled = scheduleItems.filter(isActionableResult).map((item) => ({
    source: "schedule",
    id: item.id,
    fleet: item.fleet,
    date: item.date,
    compartment: item.compartment,
    classification: item.result,
    description: item.resultDescription || "",
    action: item.resultAction || "",
    origin: "Programacao",
  }));

  const report = analyses.filter(isReportAnomaly).map((item, index) => {
    const id = reportResultId(item, index);
    const detail = reportResultDetails[id] || {};
    return {
      source: "report",
      id,
      fleet: item.cod_frota,
      date: item.data_coleta,
      compartment: item.compartimento,
      classification: item.classificacao === "Critico" ? "Critico" : "Anomalia",
      description: detail.description || item.resultado,
      action: detail.action || "",
      origin: "Relatorio CHB",
    };
  });

  return [...scheduled, ...report].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

function getFilteredResults() {
  const origin = document.querySelector("#result-filter-origin")?.value || "";
  const classification = document.querySelector("#result-filter-classification")?.value || "";
  const compartment = document.querySelector("#result-filter-compartment")?.value || "";
  const minDate = document.querySelector("#result-filter-date-min")?.value || "";
  const maxDate = document.querySelector("#result-filter-date-max")?.value || "";
  const search = (document.querySelector("#result-filter-search")?.value || "").trim().toLowerCase();

  return getUnifiedResults().filter((item) => {
    if (origin && item.origin !== origin) return false;
    if (classification && item.classification !== classification) return false;
    if (compartment && item.compartment !== compartment) return false;
    if (minDate && item.date < minDate) return false;
    if (maxDate && item.date > maxDate) return false;
    if (search) {
      const haystack = [item.fleet, item.compartment, item.classification, item.description, item.action, item.origin]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

function updateResultFilterOptions() {
  const select = document.querySelector("#result-filter-compartment");
  if (!select) return;
  const current = select.value;
  const compartments = [...new Set(getUnifiedResults().map((item) => item.compartment).filter(Boolean))].sort();
  select.innerHTML = `<option value="">Todos</option>${compartments
    .map((item) => `<option value="${item}">${item}</option>`)
    .join("")}`;
  if (compartments.includes(current)) {
    select.value = current;
  }
}

function renderResultsQueue() {
  updateResultFilterOptions();
  const queue = getFilteredResults();
  const list = document.querySelector("#result-queue");
  document.querySelector("#results-count").textContent = `${queue.length} pendente(s)`;

  if (!queue.length) {
    list.innerHTML = `<div class="empty-state">Nenhuma anomalia ou criticidade registrada.</div>`;
    return;
  }

  list.innerHTML = queue
    .map(
      (item) => `
        <button class="result-card ${item.classification === "Critico" ? "critical" : "anomaly"}" type="button" data-result-source="${item.source}" data-result-id="${item.id}">
          <div>
            <strong>${item.fleet}</strong>
            <span>${formatDate(item.date)} - ${item.compartment}</span>
            <small>${item.origin}</small>
          </div>
          <b>${item.classification}</b>
        </button>
      `
    )
    .join("");
}

function normalizeLogin(login) {
  const value = login.trim().toLowerCase();
  if (!value) return value;
  return value.includes("@") ? value : `${value}@${internalLoginDomain}`;
}

function applyUserRole(email) {
  currentUserRole = userRoles[email] || "coletor";
  document.body.dataset.role = currentUserRole;
  document.querySelectorAll(".admin-only").forEach((element) => {
    element.hidden = currentUserRole !== "admin";
  });
}

function selectResultService(source, id) {
  const item = getUnifiedResults().find((entry) => entry.source === source && String(entry.id) === String(id));
  if (!item) return;
  document.querySelector("#result-source").value = item.source;
  document.querySelector("#result-service-id").value = item.id;
  document.querySelector("#result-fleet-title").textContent = item.fleet;
  document.querySelector("#result-fleet").value = item.fleet;
  document.querySelector("#result-compartment").value = item.compartment;
  document.querySelector("#result-classification").value = item.classification;
  document.querySelector("#result-description").value = item.description || "";
  document.querySelector("#result-action").value = item.action || "";
  document.querySelector("#result-form-status").textContent = `${item.classification} - ${item.origin}`;
  document.querySelector("#result-modal").showModal();
}

function scheduleFromDb(record) {
  return {
    id: record.id,
    dbId: record.id,
    date: record.scheduled_date,
    fleet: record.cod_frota,
    compartment: record.compartimento,
    done: Boolean(record.realizado),
    result: record.resultado || "",
    completionDate: record.data_conclusao || "",
    location: record.local_execucao || "Base (Oficina)",
    resultDescription: record.detalhe_ocorrencia || "",
    resultAction: record.acao_recomendada || "",
  };
}

function scheduleToDb(item) {
  return {
    scheduled_date: item.date,
    cod_frota: item.fleet,
    compartimento: item.compartment,
    realizado: Boolean(item.done),
    resultado: item.result || null,
    data_conclusao: item.completionDate || null,
    local_execucao: item.location || null,
    detalhe_ocorrencia: item.resultDescription || null,
    acao_recomendada: item.resultAction || null,
  };
}

async function loadScheduleFromSupabase() {
  if (!supabaseClient) return;

  const { data, error } = await supabaseClient
    .from("programacao_coletas")
    .select("*")
    .order("scheduled_date", { ascending: true })
    .order("cod_frota", { ascending: true });

  if (error) {
    scheduleDbEnabled = false;
    return;
  }

  scheduleDbEnabled = true;
  scheduleItems.splice(0, scheduleItems.length, ...data.map(scheduleFromDb));
  nextScheduleId = Math.max(0, ...scheduleItems.map((item) => Number(item.id) || 0)) + 1;
  renderSchedule();
  renderResultsQueue();
}

async function saveScheduleItem(item) {
  if (!scheduleDbEnabled || !supabaseClient) return item;

  if (item.dbId) {
    const { error } = await supabaseClient
      .from("programacao_coletas")
      .update(scheduleToDb(item))
      .eq("id", item.dbId);
    if (error) throw error;
    return item;
  }

  const { data, error } = await supabaseClient
    .from("programacao_coletas")
    .insert(scheduleToDb(item))
    .select("*")
    .single();
  if (error) throw error;

  Object.assign(item, scheduleFromDb(data));
  return item;
}

async function deleteScheduleItem(item) {
  if (!scheduleDbEnabled || !supabaseClient || !item.dbId) return;
  const { error } = await supabaseClient.from("programacao_coletas").delete().eq("id", item.dbId);
  if (error) throw error;
}

function normalizeAnalysisRecord(record) {
  const resultado = (record.resultado || "SEM RESULTADO").trim();
  return {
    cod_frota: record.cod_frota || "-",
    cod_compartimento: record.cod_compartimento || "-",
    compartimento: record.compartimento || "Sem compartimento",
    data_coleta: record.data_coleta || "",
    resultado,
    classificacao: classifyAnalysis(resultado),
  };
}

function renderDashboardMetrics() {
  const total = filteredAnalyses.length;
  const critical = filteredAnalyses.filter((item) => item.classificacao === "Critico").length;
  const attention = filteredAnalyses.filter((item) => item.classificacao === "Atencao").length;
  const uniqueDates = new Set(filteredAnalyses.map((item) => item.data_coleta).filter(Boolean));
  const average = uniqueDates.size ? total / uniqueDates.size : 0;

  document.querySelector("#metric-total-analyses").textContent = total.toLocaleString("pt-BR");
  document.querySelector("#metric-daily-average").textContent = average.toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
  });
  document.querySelector("#metric-attention").textContent = attention.toLocaleString("pt-BR");
  document.querySelector("#metric-critical").textContent = critical.toLocaleString("pt-BR");
  document.querySelector("#metric-attention-rate").textContent = `${Math.round((attention / total || 0) * 100)}% da amostragem`;
  document.querySelector("#metric-critical-rate").textContent = `${Math.round((critical / total || 0) * 100)}% da amostragem`;
}

function updateDashboardFromAnalyses() {
  applyDateFilter();

  const byDate = filteredAnalyses.reduce((summary, item) => {
    if (!item.data_coleta) return summary;
    summary[item.data_coleta] = (summary[item.data_coleta] || 0) + 1;
    return summary;
  }, {});
  collectionsByDay = Object.entries(byDate)
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .slice(-14)
    .map(([date, count]) => ({ date: formatDate(date), count }));

  const criticalByCompartment = filteredAnalyses
    .filter((item) => item.classificacao === "Critico")
    .reduce((summary, item) => {
      summary[item.compartimento] = (summary[item.compartimento] || 0) + 1;
      return summary;
    }, {});
  const maxCritical = Math.max(...Object.values(criticalByCompartment), 1);
  riskByComponent = Object.entries(criticalByCompartment)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => ({ name, count, value: Math.max(6, Math.round((count / maxCritical) * 100)) }));

  priorities = filteredAnalyses
    .filter((item) => item.classificacao === "Critico")
    .sort((a, b) => (b.data_coleta || "").localeCompare(a.data_coleta || ""))
    .slice(0, 8);

  const byResult = filteredAnalyses.reduce((summary, item) => {
    summary[item.resultado] = (summary[item.resultado] || 0) + 1;
    return summary;
  }, {});
  const maxResult = Math.max(...Object.values(byResult), 1);
  resultDistribution = Object.entries(byResult)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({
      name,
      count,
      value: Math.max(6, Math.round((count / maxResult) * 100)),
      className: classifyAnalysis(name).toLowerCase(),
    }));

  renderDashboardMetrics();
  renderChart();
  renderRisks();
  renderPriorities();
  renderResultDistribution();
  renderResultsQueue();
}

function applyDateFilter() {
  const min = document.querySelector("#date-min").value;
  const max = document.querySelector("#date-max").value;

  filteredAnalyses = analyses.filter((item) => {
    if (!item.data_coleta) return false;
    if (min && item.data_coleta < min) return false;
    if (max && item.data_coleta > max) return false;
    return true;
  });
}

function setDefaultDateRange() {
  const dates = analyses.map((item) => item.data_coleta).filter(Boolean).sort();
  if (!dates.length) return;
  document.querySelector("#date-min").value = dates[0];
  document.querySelector("#date-max").value = dates[dates.length - 1];
}

async function loadAnalysisCsv() {
  const status = document.querySelector("#metric-report-status");
  try {
    const response = await fetch(analysisCsvPath);
    if (!response.ok) throw new Error("Relatorio nao encontrado");
    const text = await response.text();
    activeReportKey = "default";
    reportResultDetails = {};
    analyses = parseCsv(text).map(normalizeAnalysisRecord);
    setDefaultDateRange();
    status.textContent = `Relatorio CHB carregado: ${analysisCsvPath}`;
  } catch (error) {
    analyses = [];
    status.textContent = "Relatorio CHB nao carregado. Abra por servidor local ou GitHub Pages.";
  }

  updateDashboardFromAnalyses();
}

function normalizeExcelDate(value) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number" && window.XLSX?.SSF) {
    const parsed = window.XLSX.SSF.parse_date_code(value);
    if (!parsed) return "";
    return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }

  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  if (/^\d{2}\/\d{2}\/\d{4}/.test(text)) {
    const [day, month, year] = text.slice(0, 10).split("/");
    return `${year}-${month}-${day}`;
  }
  return text;
}

function recordsFromWorkbook(workbook) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  return rows
    .slice(1)
    .filter((row) => row[1])
    .map((row) =>
      normalizeAnalysisRecord({
        cod_frota: String(row[1] || "").trim(),
        cod_compartimento: String(row[5] || "").trim(),
        compartimento: String(row[6] || "").trim(),
        data_coleta: normalizeExcelDate(row[13]),
        resultado: String(row[73] || "SEM RESULTADO").trim(),
      })
    );
}

async function handleAnalysisUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const status = document.querySelector("#metric-report-status");
  const fileName = document.querySelector("#report-file-name");
  const extension = file.name.split(".").pop().toLowerCase();

  try {
    activeReportKey = `upload-${file.name}-${file.size}-${file.lastModified}`.replace(/\s+/g, "-");
    reportResultDetails = {};
    if (extension === "csv") {
      const text = await file.text();
      analyses = parseCsv(text).map(normalizeAnalysisRecord);
    } else {
      const buffer = await file.arrayBuffer();
      const workbook = window.XLSX.read(buffer, { type: "array", cellDates: true });
      analyses = recordsFromWorkbook(workbook);
    }

    setDefaultDateRange();
    fileName.textContent = file.name;
    status.textContent = `Relatorio carregado pelo usuario: ${file.name}`;
    updateDashboardFromAnalyses();
  } catch (error) {
    status.textContent = "Nao foi possivel ler o relatorio enviado.";
  }
}

function renderFleet(rows = fleet) {
  const table = document.querySelector("#fleet-table");
  table.innerHTML = rows
    .map(
      (row) => `
        <tr>
          <td><strong>${row.codigo}</strong></td>
          <td>${row.agrupamento}</td>
          <td>${row.especialidade}</td>
          <td>${row.descricao}</td>
          <td>${tagFor(row.risco)}</td>
        </tr>
      `
    )
    .join("");
}

function renderFleetSummary(rows = fleet) {
  const total = rows.length;
  const groups = rows.reduce((summary, row) => {
    summary[row.agrupamento] = (summary[row.agrupamento] || 0) + 1;
    return summary;
  }, {});
  const topGroups = Object.entries(groups)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  document.querySelector("#fleet-total").textContent = total.toLocaleString("pt-BR");
  document.querySelector("#fleet-groups").innerHTML = topGroups
    .map(
      ([name, count]) => `
        <div class="risk-item">
          <div class="risk-meta"><strong>${name}</strong><span>${count}</span></div>
          <div class="track"><div class="fill fleet-fill" style="width:${Math.max(5, (count / total) * 100)}%"></div></div>
        </div>
      `
    )
    .join("");
}

async function loadFleetCsv() {
  const status = document.querySelector("#fleet-load-status");
  try {
    const response = await fetch(fleetCsvPath);
    if (!response.ok) throw new Error("CSV nao encontrado");
    const text = await response.text();
    fleet = parseCsv(text).map(normalizeFleetRecord);
    status.textContent = `Base real carregada de ${fleetCsvPath}`;
  } catch (error) {
    status.textContent = "Usando amostra local. Para carregar o CSV real, abra por servidor local ou GitHub Pages.";
  }

  renderFleetSummary(fleet);
  renderFleet(fleet);
}

async function loadFleetFromSupabase() {
  const status = document.querySelector("#fleet-load-status");
  if (!supabaseClient) {
    await loadFleetCsv();
    return;
  }

  const { data, error } = await supabaseClient
    .from("frotas")
    .select("cod_frota, descricao_especialidade, descricao_especialidade_agrup, descricao_frota")
    .order("cod_frota", { ascending: true });

  if (error || !data?.length) {
    status.textContent = "Banco nao retornou frotas. Usando CSV local como fallback.";
    await loadFleetCsv();
    return;
  }

  fleet = data.map(normalizeFleetRecord);
  status.textContent = "Base real carregada do Supabase.";
  renderFleetSummary(fleet);
  renderFleet(fleet);
}

async function handleFleetSubmit(event) {
  event.preventDefault();
  const message = document.querySelector("#fleet-form-message");

  if (!supabaseClient) {
    message.textContent = "Supabase nao carregado no navegador.";
    return;
  }

  const payload = {
    cod_frota: document.querySelector("#new-cod-frota").value.trim(),
    descricao_especialidade: document.querySelector("#new-especialidade").value.trim(),
    descricao_especialidade_agrup: document.querySelector("#new-agrupamento").value.trim(),
    descricao_frota: document.querySelector("#new-descricao-frota").value.trim(),
    status: "Ativo",
  };

  if (!payload.cod_frota || !payload.descricao_frota) {
    message.textContent = "Informe codigo da frota e descricao.";
    return;
  }

  message.textContent = "Gravando no Supabase...";
  const { error } = await supabaseClient.from("frotas").insert(payload);

  if (error) {
    if (error.code === "23505") {
      message.textContent = "Esta frota ja existe no banco.";
    } else {
      message.textContent = `Erro ao gravar: ${error.message}`;
    }
    return;
  }

  message.textContent = "Frota adicionada com sucesso.";
  event.target.reset();
  await loadFleetFromSupabase();
}

async function refreshSession() {
  if (!supabaseClient) return;

  const { data } = await supabaseClient.auth.getSession();
  const session = data.session;
  const authPanel = document.querySelector("#auth-panel");
  const sessionStatus = document.querySelector("#session-status");
  const logoutButton = document.querySelector("#logout-button");
  const privateAreas = document.querySelectorAll(".app-private");

  if (session) {
    document.body.classList.add("is-authenticated");
    authPanel.hidden = true;
    logoutButton.hidden = false;
    applyUserRole(session.user.email);
    sessionStatus.textContent = `${session.user.email} - ${currentUserRole}`;
    privateAreas.forEach((area) => {
      area.hidden = false;
    });
    await loadAnalysisCsv();
    await loadFleetFromSupabase();
    await loadScheduleFromSupabase();
  } else {
    document.body.classList.remove("is-authenticated");
    authPanel.hidden = false;
    logoutButton.hidden = true;
    sessionStatus.textContent = "Nao conectado";
    applyUserRole("");
    privateAreas.forEach((area) => {
      area.hidden = true;
    });
  }
}

document.querySelector("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = document.querySelector("#login-message");
  const email = normalizeLogin(document.querySelector("#login-email").value);
  const password = document.querySelector("#login-password").value;

  message.textContent = "Entrando...";
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    message.textContent = `Erro no login: ${error.message}`;
    return;
  }

  message.textContent = "Login realizado.";
  await refreshSession();
});

document.querySelector("#logout-button").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  await refreshSession();
});

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    const view = button.dataset.view;
    document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("active"));
    document.querySelectorAll(".view").forEach((section) => section.classList.remove("active"));
    button.classList.add("active");
    document.querySelector(`#${view}`).classList.add("active");
    document.querySelector("#page-title").textContent = pageTitles[view];
  });
});

document.querySelector("#fleet-search").addEventListener("input", (event) => {
  const term = event.target.value.trim().toLowerCase();
  const filtered = fleet.filter((row) => Object.values(row).join(" ").toLowerCase().includes(term));
  renderFleet(filtered);
  renderFleetSummary(filtered);
});

document.querySelector("#fleet-form").addEventListener("submit", handleFleetSubmit);

document.querySelector("#analysis-upload").addEventListener("change", handleAnalysisUpload);
document.querySelector("#date-min").addEventListener("change", updateDashboardFromAnalyses);
document.querySelector("#date-max").addEventListener("change", updateDashboardFromAnalyses);
document.querySelector("#clear-date-filter").addEventListener("click", () => {
  document.querySelector("#date-min").value = "";
  document.querySelector("#date-max").value = "";
  updateDashboardFromAnalyses();
});

document.querySelectorAll("[data-schedule-view]").forEach((button) => {
  button.addEventListener("click", () => {
    scheduleView = button.dataset.scheduleView;
    document.querySelectorAll("[data-schedule-view]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderSchedule();
  });
});

document.querySelector("#prev-period").addEventListener("click", () => {
  scheduleAnchor = scheduleView === "week" ? addDays(scheduleAnchor, -7) : new Date(scheduleAnchor.getFullYear(), scheduleAnchor.getMonth() - 1, 1);
  renderSchedule();
});

document.querySelector("#today-period").addEventListener("click", () => {
  scheduleAnchor = new Date();
  renderSchedule();
});

document.querySelector("#next-period").addEventListener("click", () => {
  scheduleAnchor = scheduleView === "week" ? addDays(scheduleAnchor, 7) : new Date(scheduleAnchor.getFullYear(), scheduleAnchor.getMonth() + 1, 1);
  renderSchedule();
});

document.querySelector("#schedule-add-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = document.querySelector("#schedule-add-message");
  const date = document.querySelector("#schedule-date").value;
  const compartment = document.querySelector("#schedule-compartment").value.trim();
  const singleFleet = document.querySelector("#schedule-single-fleet").value.trim();
  const fleets = singleFleet ? [singleFleet] : [];

  if (!date || !compartment || !fleets.length) {
    message.textContent = "Informe data, servico e ao menos uma frota.";
    return;
  }

  try {
    for (const fleetCode of fleets) {
      const item = {
      id: nextScheduleId,
      date,
      fleet: fleetCode,
      compartment,
      done: false,
      };
      scheduleItems.push(item);
      nextScheduleId += 1;
      await saveScheduleItem(item);
    }
  } catch (error) {
    message.textContent = `Erro ao gravar programacao: ${error.message}`;
    return;
  }

  scheduleAnchor = new Date(`${date}T12:00:00`);
  message.textContent = `${fleets.length} servico(s) agendado(s).`;
  event.target.reset();
  document.querySelector("#schedule-compartment").value = compartment;
  renderSchedule();
});

document.querySelector("#open-batch-modal").addEventListener("click", () => {
  const date = document.querySelector("#schedule-date").value || toDateKey(scheduleAnchor);
  batchEndDateTouched = false;
  document.querySelector("#batch-start-date").value = date;
  document.querySelector("#batch-end-date").value = toDateKey(addDays(new Date(`${date}T12:00:00`), 6));
  document.querySelector("#batch-compartment").value = document.querySelector("#schedule-compartment").value || "CARTER MOTOR";
  updateBatchPreview();
  document.querySelector("#batch-modal").showModal();
});

document.querySelector("#close-batch-modal").addEventListener("click", () => {
  document.querySelector("#batch-modal").close();
});

document.querySelector("#batch-modal").addEventListener("click", (event) => {
  if (event.target.id === "batch-modal") {
    event.currentTarget.close();
  }
});

document.querySelector("#batch-schedule-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = document.querySelector("#batch-message");
  const { startDate, endDate, compartment, fleets, weekdays } = getBatchFormData();

  if (!startDate || !endDate || !compartment || !fleets.length || !weekdays.length) {
    message.textContent = "Informe periodo, servico, frotas e ao menos um dia da semana.";
    return;
  }

  if (endDate < startDate) {
    message.textContent = "A data final deve ser maior ou igual a data inicial.";
    return;
  }

  const availableDates = allowedDatesInRange(startDate, endDate, weekdays);
  if (!availableDates.length) {
    message.textContent = "Nao ha dias selecionados dentro do periodo informado.";
    return;
  }

  const distribution = distributeFleetsAcrossWeekdays(fleets, startDate, endDate, weekdays);
  try {
    for (const entry of distribution) {
      const item = {
      id: nextScheduleId,
      date: entry.date,
      fleet: entry.fleetCode,
      compartment,
      done: false,
      };
      scheduleItems.push(item);
      nextScheduleId += 1;
      await saveScheduleItem(item);
    }
  } catch (error) {
    message.textContent = `Erro ao gravar programacao: ${error.message}`;
    return;
  }

  scheduleAnchor = new Date(`${startDate}T12:00:00`);
  message.textContent = `${fleets.length} frota(s) distribuidas no periodo.`;
  document.querySelector("#schedule-date").value = startDate;
  document.querySelector("#schedule-compartment").value = compartment;
  event.target.reset();
  document.querySelector("#batch-compartment").value = compartment;
  document.querySelector("#batch-modal").close();
  renderSchedule();
});

document.querySelector("#batch-start-date").addEventListener("input", () => {
  const startDate = document.querySelector("#batch-start-date").value;
  if (startDate && !batchEndDateTouched) {
    document.querySelector("#batch-end-date").value = toDateKey(addDays(new Date(`${startDate}T12:00:00`), 6));
  }
  updateBatchPreview();
});

document.querySelector("#batch-end-date").addEventListener("input", () => {
  batchEndDateTouched = true;
  updateBatchPreview();
});

document.querySelector("#batch-fleets").addEventListener("input", updateBatchPreview);

document.querySelector("#batch-schedule-form").addEventListener("reset", () => {
  batchEndDateTouched = false;
});

document.querySelectorAll(".weekday-picker input").forEach((input) => {
  input.addEventListener("change", updateBatchPreview);
});

document.querySelector("#schedule-grid").addEventListener("click", (event) => {
  const serviceCard = event.target.closest("[data-service-id]");
  if (serviceCard) {
    openServiceModal(Number(serviceCard.dataset.serviceId));
    return;
  }

  if (event.target.closest("input")) return;
  const day = event.target.closest("[data-schedule-date]");
  if (!day) return;
  openScheduleModal(day.dataset.scheduleDate);
});

document.querySelector("#close-schedule-modal").addEventListener("click", () => {
  document.querySelector("#schedule-modal").close();
});

document.querySelector("#schedule-modal").addEventListener("click", (event) => {
  if (event.target.id === "schedule-modal") {
    event.currentTarget.close();
  }
});

document.querySelector("#modal-task-list").addEventListener("click", async (event) => {
  const serviceCard = event.target.closest("[data-service-id]");
  if (serviceCard) {
    openServiceModal(Number(serviceCard.dataset.serviceId));
    return;
  }

  const id = Number(event.target.dataset.deleteScheduleId);
  if (!id) return;
  const index = scheduleItems.findIndex((entry) => entry.id === id);
  if (index >= 0) {
    try {
      await deleteScheduleItem(scheduleItems[index]);
      scheduleItems.splice(index, 1);
    } catch (error) {
      return;
    }
  }
  renderSchedule();
  openScheduleModal(selectedScheduleDate);
});

document.querySelector("#close-service-modal").addEventListener("click", () => {
  document.querySelector("#service-modal").close();
});

document.querySelector("#service-modal").addEventListener("click", (event) => {
  if (event.target.id === "service-modal") {
    event.currentTarget.close();
  }
});

document.querySelector("#service-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const item = scheduleItems.find((entry) => entry.id === selectedServiceId);
  if (!item) return;

  item.compartment = document.querySelector("#service-compartment").value.trim();
  item.done = document.querySelector("#service-status").value === "Realizada";
  item.result = document.querySelector("#service-result").value;
  item.completionDate = document.querySelector("#service-completion-date").value;
  item.location = document.querySelector("#service-location").value;

  try {
    await saveScheduleItem(item);
  } catch (error) {
    return;
  }

  renderSchedule();
  renderResultsQueue();
  if (selectedScheduleDate && document.querySelector("#schedule-modal").open) {
    openScheduleModal(selectedScheduleDate);
  }
  document.querySelector("#service-modal").close();
});

document.querySelector("#result-queue").addEventListener("click", (event) => {
  const card = event.target.closest("[data-result-id]");
  if (!card) return;
  selectResultService(card.dataset.resultSource, card.dataset.resultId);
});

[
  "#result-filter-origin",
  "#result-filter-classification",
  "#result-filter-compartment",
  "#result-filter-date-min",
  "#result-filter-date-max",
  "#result-filter-search",
].forEach((selector) => {
  document.querySelector(selector).addEventListener("input", renderResultsQueue);
});

document.querySelector("#clear-result-filters").addEventListener("click", () => {
  document.querySelector("#result-filter-origin").value = "";
  document.querySelector("#result-filter-classification").value = "";
  document.querySelector("#result-filter-compartment").value = "";
  document.querySelector("#result-filter-date-min").value = "";
  document.querySelector("#result-filter-date-max").value = "";
  document.querySelector("#result-filter-search").value = "";
  renderResultsQueue();
});

document.querySelector("#close-result-modal").addEventListener("click", () => {
  document.querySelector("#result-modal").close();
});

document.querySelector("#result-modal").addEventListener("click", (event) => {
  if (event.target.id === "result-modal") {
    event.currentTarget.close();
  }
});

document.querySelector("#result-detail-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const source = document.querySelector("#result-source").value;
  const id = document.querySelector("#result-service-id").value;

  if (source === "schedule") {
    const item = scheduleItems.find((entry) => String(entry.id) === String(id));
    if (!item) return;
    item.result = document.querySelector("#result-classification").value;
    item.resultDescription = document.querySelector("#result-description").value.trim();
    item.resultAction = document.querySelector("#result-action").value.trim();
    try {
      await saveScheduleItem(item);
    } catch (error) {
      document.querySelector("#result-form-status").textContent = `Erro ao salvar: ${error.message}`;
      return;
    }
  } else {
    reportResultDetails[id] = {
      classification: document.querySelector("#result-classification").value,
      description: document.querySelector("#result-description").value.trim(),
      action: document.querySelector("#result-action").value.trim(),
    };
  }

  document.querySelector("#result-form-status").textContent = "Ocorrencia salva";
  renderResultsQueue();
  renderSchedule();
  document.querySelector("#result-modal").close();
});

renderSchedule();
renderResultsQueue();
refreshSession();
