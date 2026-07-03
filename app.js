const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const STORAGE_KEY = "finance-script-workbench-v1";
const riskRules = [
  "稳赚", "必涨", "必跌", "百分百", "保证收益", "确定上涨", "确定下跌",
  "确定的入场", "赶紧买", "马上买", "立即买入", "建议买入", "建议卖出",
  "抄底机会", "闭眼买", "梭哈", "翻倍机会", "零风险", "绝对不会",
  "所有机构都", "顶级机构都", "最后上车机会"
];

let state = {
  topics: [],
  selectedId: null
};

function value(id) {
  return $(id).value.trim();
}

function cleanText(text) {
  return text.replace(/\s+/g, "");
}

function todayStamp() {
  const date = new Date();
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
}

function safeFilename(text) {
  return text.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "").slice(0, 24) || "财经选题";
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 1600);
}

async function copyText(text, success) {
  if (!text.trim()) {
    showToast("没有可复制的内容");
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
  showToast(success);
}

function formData() {
  return {
    keyword: value("#keyword"),
    platform: $("#platform").value,
    targetLength: Number($("#targetLength").value),
    tone: $("#tone").value,
    sourceText: value("#sourceText"),
    sourceUrl: value("#sourceUrl"),
    extraRule: value("#extraRule"),
    topicResponse: value("#topicResponse"),
    scriptText: value("#scriptText"),
    version: $("#version").value,
    topics: state.topics,
    selectedId: state.selectedId
  };
}

function saveDraft() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(formData()));
  $("#saveState").innerHTML = "<i></i>已自动保存";
}

function scheduleSave() {
  $("#saveState").innerHTML = "<i></i>保存中...";
  clearTimeout(scheduleSave.timer);
  scheduleSave.timer = setTimeout(saveDraft, 450);
}

function restoreDraft() {
  let data;
  try {
    data = JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return;
  }
  if (!data) return;
  const fields = ["keyword", "platform", "targetLength", "tone", "sourceText", "sourceUrl", "extraRule", "topicResponse", "scriptText", "version"];
  fields.forEach((key) => {
    const node = $(`#${key}`);
    if (node && data[key] !== undefined) node.value = data[key];
  });
  state.topics = Array.isArray(data.topics) ? data.topics : [];
  state.selectedId = data.selectedId ?? null;
}

function requireKeyword() {
  if (value("#keyword")) return true;
  $("#keyword").focus();
  showToast("请先填写核心关键词");
  return false;
}

function makeTopicPrompt() {
  const data = formData();
  return `你是一名财经短视频选题编辑。请只根据我提供的资料完成选题，不要虚构实时数据。

【热点事件】
${data.keyword}

【参考资料】
${data.sourceText || "未提供详细资料。不得自行编造具体数字、机构观点或新闻进展。"}

【来源链接】
${data.sourceUrl || "未提供"}

【平台与表达】
平台：${data.platform}
语气：${data.tone}
补充要求：${data.extraRule || "从普通人利益出发，不推荐具体股票或期货，不承诺收益。"}

任务：
1. 从“颠覆认知、钱与利益、强烈反差、宏观影响”四个方向生成10个短视频标题。
2. 标题必须有明确判断和冲突，禁止中性描述。
3. 逐条评分：情绪冲突0-30、钱相关0-25、认知反转0-25、普通人关联0-20。
4. 评分必须有差异，不要全部给高分。
5. 不使用“稳赚、必涨、确定入场、闭眼买”等收益承诺或直接投资建议。

严格按以下格式输出，每条一行，不要输出其他内容：
序号|方向|标题|情绪冲突分|钱相关分|认知反转分|普通人关联分|一句话理由

示例：
1|颠覆认知|标题内容|26|20|23|18|理由内容`;
}

function scoreTitle(title, angle, index) {
  const base = {
    "颠覆认知": [25, 19, 23, 17],
    "钱与利益": [26, 24, 19, 19],
    "强烈反差": [28, 21, 22, 18],
    "宏观影响": [23, 22, 20, 20]
  }[angle] || [23, 20, 20, 18];
  const variation = [0, 2, -1, 1, -2, 0, 1, -1, 2, 0][index % 10];
  const conflict = Math.max(0, Math.min(30, base[0] + variation));
  const money = Math.max(0, Math.min(25, base[1] + (/钱|资产|工资|存款|财富|买单|收割/.test(title) ? 1 : 0)));
  const reversal = Math.max(0, Math.min(25, base[2] + (/以为|真正|反而|根本|却/.test(title) ? 1 : 0)));
  const relevance = Math.max(0, Math.min(20, base[3] + (/普通人|你|家庭|工资|存款/.test(title) ? 1 : 0)));
  return { conflict, money, reversal, relevance, total: conflict + money + reversal + relevance };
}

function localTopicList(keyword) {
  return [
    ["颠覆认知", `别只看${keyword}涨跌，真正改变的是普通人的财富顺序`],
    ["钱与利益", `${keyword}一变天，谁在赚钱，谁又在替市场买单？`],
    ["强烈反差", `所有人都在追${keyword}，聪明的钱却开始做另一件事`],
    ["宏观影响", `${keyword}背后的大账：你的工资、存款和月供都躲不开`],
    ["颠覆认知", `你以为${keyword}影响的是投资者？最先感受到的可能是普通家庭`],
    ["钱与利益", `别被热搜带节奏，${keyword}正在重新分配三类人的利益`],
    ["强烈反差", `${keyword}越热，为什么最着急的人反而越容易吃亏？`],
    ["宏观影响", `政策信号已经变化，还按老逻辑看${keyword}的人要小心了`],
    ["钱与利益", `${keyword}的真相很现实：有人拿走收益，有人承担成本`],
    ["强烈反差", `嘴上都在看好${keyword}，真正的分歧却藏在这个细节里`]
  ].map(([angle, title], index) => ({
    id: Date.now() + index,
    angle,
    title,
    reason: "根据冲突、利益、反转与普通人关联进行本地初筛。",
    scores: scoreTitle(title, angle, index)
  }));
}

function normalizeAngle(text) {
  if (/颠覆|认知/.test(text)) return "颠覆认知";
  if (/钱|利益|财富/.test(text)) return "钱与利益";
  if (/反差|反转/.test(text)) return "强烈反差";
  if (/宏观|政策|经济/.test(text)) return "宏观影响";
  return "综合冲突";
}

function parseTopicResponse(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const parsed = [];
  lines.forEach((line) => {
    if (parsed.length >= 10) return;
    const pipe = line.split("|").map((part) => part.trim());
    if (pipe.length >= 3 && /^\d+/.test(pipe[0])) {
      const angle = normalizeAngle(pipe[1]);
      const title = pipe[2].replace(/^["“]|["”]$/g, "");
      const nums = pipe.slice(3, 7).map(Number);
      const validScores = nums.length === 4 && nums.every(Number.isFinite);
      const scores = validScores
        ? { conflict: Math.min(30, nums[0]), money: Math.min(25, nums[1]), reversal: Math.min(25, nums[2]), relevance: Math.min(20, nums[3]) }
        : scoreTitle(title, angle, parsed.length);
      scores.total = scores.conflict + scores.money + scores.reversal + scores.relevance;
      parsed.push({
        id: Date.now() + parsed.length,
        angle,
        title,
        scores,
        reason: pipe[7] || "由AI生成，已按四维度评分。"
      });
      return;
    }
    const match = line.match(/^\s*(?:TOP\s*)?(\d{1,2})[.、：:）)]\s*(.+)$/i);
    if (match && match[2].length >= 8) {
      const raw = match[2].replace(/\（?\d{1,3}分?\）?$/, "").trim();
      const angle = normalizeAngle(raw);
      parsed.push({
        id: Date.now() + parsed.length,
        angle,
        title: raw,
        scores: scoreTitle(raw, angle, parsed.length),
        reason: "已根据标题内容进行本地补充评分。"
      });
    }
  });
  return parsed;
}

function rankedTopics() {
  return [...state.topics].sort((a, b) => b.scores.total - a.scores.total);
}

function selectedTopic() {
  return state.topics.find((topic) => topic.id === state.selectedId) || null;
}

function renderTopics() {
  const hasTopics = state.topics.length > 0;
  $("#topicEmpty").classList.toggle("hidden", hasTopics);
  $("#topicsArea").classList.toggle("hidden", !hasTopics);
  if (!hasTopics) return;

  const ranks = new Map(rankedTopics().slice(0, 3).map((topic, index) => [topic.id, `TOP${index + 1}`]));
  $("#topicList").innerHTML = rankedTopics().map((topic) => {
    const rank = ranks.get(topic.id);
    return `<button type="button" class="topic-card ${rank ? "top3" : ""} ${topic.id === state.selectedId ? "selected" : ""}" data-id="${topic.id}" data-rank="${rank || ""}">
      <span class="angle">${topic.angle}</span>
      <p>${escapeHtml(topic.title)}</p>
      <span class="score">综合评分 <b>${topic.scores.total}</b>/100 · 冲突${topic.scores.conflict} · 钱${topic.scores.money} · 反转${topic.scores.reversal} · 关联${topic.scores.relevance}</span>
    </button>`;
  }).join("");

  $$("[data-id]").forEach((card) => card.addEventListener("click", () => {
    state.selectedId = Number(card.dataset.id);
    renderTopics();
    updateChosenTopic();
    scheduleSave();
  }));

  const chosen = selectedTopic();
  $("#selectedTopicText").textContent = chosen ? chosen.title : "尚未选择";
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}

function chooseDefaultTopic() {
  if (!state.selectedId && state.topics.length) {
    state.selectedId = rankedTopics()[0].id;
  }
}

function updateChosenTopic() {
  const chosen = selectedTopic();
  $("#chosenTopic").textContent = chosen ? chosen.title : "请先在上一步选择选题";
  $("#scriptTarget").textContent = `目标约 ${$("#targetLength").value} 字`;
}

function makeScriptPrompt() {
  const data = formData();
  const chosen = selectedTopic();
  if (!chosen) return "";
  return `你是一名财经短视频口播编辑。请基于选题和参考资料生成一篇可直接用于${data.platform}的口播稿。

【最终选题】
${chosen.title}

【选题方向】
${chosen.angle}

【参考资料】
${data.sourceText || "未提供详细资料。禁止新增未经证实的具体数据、机构观点和实时进展。"}

【来源链接】
${data.sourceUrl || "未提供"}

【硬性要求】
1. 全文约${data.targetLength}字，允许上下浮动10%。
2. 第一句直接表达冲突观点，不要“大家好”“最近”“你知道吗”等铺垫。
3. 口语化，每句话尽量短，适合TTS朗读。
4. 每3—5句至少出现一次反问、转折或强调。
5. 必须解释对普通人的现实利益影响。
6. 只使用参考资料中能够确认的数据；资料未提供的数据不得自行补充。
7. 不推荐具体股票、基金、期货或买卖时点。
8. 禁止收益保证和绝对化措辞，如“稳赚、必涨、确定入场、闭眼买”。
9. 如表达预测，必须明确这是判断而不是事实。
10. 结尾用一个有争议的问题引导评论。
11. ${data.extraRule || "观点明确，但保留风险和反方可能性。"}
12. 语气：${data.tone}。

只输出纯口播正文，不要标题、分镜、序号、Markdown或解释。`;
}

function makeLocalScript() {
  const data = formData();
  const chosen = selectedTopic();
  if (!chosen) return "";
  const sourceSignal = data.sourceText
    ? "你现在看到的消息和数据，真正值得关注的不是某一个孤立数字，而是它们正在把市场预期推向哪个方向。"
    : "这里不引用未经核实的实时数字，我们只讨论这件事背后的利益逻辑。";
  return `${chosen.title}。

先别急着跟着情绪下结论。
同一个热点，有人看到机会，有人看到风险，但普通人最容易忽略的，是判断错误以后到底由谁承担成本。

${sourceSignal}

为什么这件事值得关注？
因为财经热点从来不只影响屏幕上的价格。它会通过资金成本、企业经营、就业预期和家庭支出，一层一层传到每个人身上。

表面上看，大家讨论的是${data.keyword}。
实际上，背后争夺的是定价权，是现金流，也是普通人在下一阶段还有没有选择。

真正需要警惕的是，市场情绪往往跑在事实前面。
消息刚出来时，最激烈的声音最容易获得关注，但声音大不等于证据充分。
上涨时，人们会把乐观当成趋势；下跌时，又会把恐慌当成结论。
结果就是，在最需要冷静的时候，做出最情绪化的决定。

所以判断${data.keyword}，至少要看三件事。

第一，事实有没有发生变化，而不是标题有没有变化。
第二，资金为什么行动，它交易的是短期情绪，还是长期逻辑。
第三，这个变化最终影响的是谁的收入、成本和资产。

如果只能记住一句话，那就是：财经热点可以有鲜明观点，但不能用情绪代替证据。

对普通人来说，重要的不是每一次都猜对，而是在判断错误时仍然保留余地。
不要因为害怕错过，就把不确定性说成确定性；也不要因为短期波动，就把长期逻辑全部推翻。

${chosen.title}，你认同这个判断吗？
你觉得这一次改变的是短期情绪，还是更长期的利益格局？评论区说说你的理由。`;
}

function analyzeScript() {
  const text = value("#scriptText");
  const chars = cleanText(text).length;
  const target = Number($("#targetLength").value);
  const seconds = Math.round(chars / 380 * 60);
  const numbers = text.match(/\d+(?:\.\d+)?%?/g) || [];
  const hits = riskRules.filter((word) => text.includes(word));

  $("#charMetric").textContent = chars;
  $("#durationMetric").textContent = seconds >= 60 ? `${Math.floor(seconds / 60)}分${seconds % 60}秒` : `${seconds}秒`;
  $("#numberMetric").textContent = numbers.length;
  $("#riskMetric").textContent = hits.length;

  if (!chars) {
    $("#charStatus").textContent = "等待文案";
  } else if (chars < target * .9) {
    $("#charStatus").textContent = `偏短，目标${target}字`;
  } else if (chars > target * 1.1) {
    $("#charStatus").textContent = `偏长，目标${target}字`;
  } else {
    $("#charStatus").textContent = "长度合适";
  }

  const panel = $("#riskPanel");
  if (!chars) {
    panel.className = "risk-panel safe";
    $("#riskIcon").textContent = "✓";
    $("#riskTitle").textContent = "等待文案检查";
    $("#riskDetail").textContent = "输入正文后自动扫描绝对化、收益承诺和直接建议措辞。";
    $("#riskStatus").textContent = "未发现";
  } else if (hits.length) {
    panel.className = "risk-panel danger";
    $("#riskIcon").textContent = "!";
    $("#riskTitle").textContent = `发现 ${hits.length} 个需要人工确认的表达`;
    $("#riskDetail").textContent = hits.join("、");
    $("#riskStatus").textContent = hits.join("、");
  } else {
    panel.className = "risk-panel safe";
    $("#riskIcon").textContent = "✓";
    $("#riskTitle").textContent = "未发现预设高风险措辞";
    $("#riskDetail").textContent = "仍需人工核对事实、平台规则和公司内部要求。";
    $("#riskStatus").textContent = "未发现";
  }
}

function exportText() {
  const data = formData();
  const chosen = selectedTopic();
  if (!data.scriptText) {
    $("#scriptText").focus();
    showToast("请先填写口播正文");
    return;
  }
  const output = `标题：${chosen?.title || data.keyword}

${data.scriptText}

——
关键词：${data.keyword}
平台：${data.platform}
版本：${data.version}
来源：${data.sourceUrl || "未填写"}
备注：内容仅供创作参考，发布前请核验事实及合规要求。`;
  const blob = new Blob([`\uFEFF${output}`], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${todayStamp()}_${safeFilename(data.keyword)}_口播_${data.version}.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("TXT 已导出");
}

$("#toTopicsBtn").addEventListener("click", () => {
  if (!requireKeyword()) return;
  $("#step2").scrollIntoView({ behavior: "smooth" });
});

$("#copyTopicPromptBtn").addEventListener("click", () => {
  if (!requireKeyword()) return;
  copyText(makeTopicPrompt(), "选题提示词已复制");
  $("#importBox").open = true;
});

$("#localTopicsBtn").addEventListener("click", () => {
  if (!requireKeyword()) return;
  state.topics = localTopicList(value("#keyword"));
  state.selectedId = null;
  chooseDefaultTopic();
  renderTopics();
  updateChosenTopic();
  scheduleSave();
  showToast("已生成10个本地选题");
});

$("#parseTopicsBtn").addEventListener("click", () => {
  const parsed = parseTopicResponse(value("#topicResponse"));
  if (parsed.length < 3) {
    showToast("未识别到足够选题，请检查格式");
    return;
  }
  state.topics = parsed;
  state.selectedId = null;
  chooseDefaultTopic();
  renderTopics();
  updateChosenTopic();
  scheduleSave();
  showToast(`已解析 ${parsed.length} 个选题`);
});

$("#toScriptBtn").addEventListener("click", () => {
  if (!selectedTopic()) {
    showToast("请先选择一个选题");
    return;
  }
  updateChosenTopic();
  $("#step3").scrollIntoView({ behavior: "smooth" });
});

$("#copyScriptPromptBtn").addEventListener("click", () => {
  if (!selectedTopic()) {
    showToast("请先在上一步选择选题");
    return;
  }
  copyText(makeScriptPrompt(), "口播提示词已复制");
});

$("#localScriptBtn").addEventListener("click", () => {
  if (!selectedTopic()) {
    showToast("请先在上一步选择选题");
    return;
  }
  $("#scriptText").value = makeLocalScript();
  analyzeScript();
  scheduleSave();
  showToast("已生成结构草稿");
});

$("#copyScriptBtn").addEventListener("click", () => copyText(value("#scriptText"), "口播正文已复制"));
$("#exportTxtBtn").addEventListener("click", exportText);

$("#resetBtn").addEventListener("click", () => {
  if (!confirm("确定清空当前任务并新建吗？")) return;
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
});

$$("input, textarea, select").forEach((node) => node.addEventListener("input", () => {
  if (node.id === "sourceText") $("#sourceCount").textContent = node.value.length;
  if (node.id === "scriptText" || node.id === "targetLength") analyzeScript();
  if (node.id === "targetLength") updateChosenTopic();
  scheduleSave();
}));

restoreDraft();
$("#sourceCount").textContent = $("#sourceText").value.length;
renderTopics();
updateChosenTopic();
analyzeScript();
