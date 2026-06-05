// 노션 타임블록 동기화 API (Vercel 서버리스 함수)
// 노션 API 버전 2025-09-03 (data_sources 방식)

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_DATABASE_ID;
const SYNC_SECRET = process.env.SYNC_SECRET || ""; // 선택: 간단한 보호용 비밀키
const NOTION_VERSION = "2025-09-03";
const TZ = "+09:00"; // 한국 시간

// 노션 DB 속성 이름 (DB 만들 때 이 이름 그대로 써주세요)
const PROP = {
  title: "Title",
  time: "Time",
  category: "Category",
  url: "URL",
  done: "Done",
};

let cachedDataSourceId = null;

async function notion(path, options = {}) {
  const res = await fetch(`https://api.notion.com/v1/${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Notion ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

async function getDataSourceId() {
  if (cachedDataSourceId) return cachedDataSourceId;
  const db = await notion(`databases/${DATABASE_ID}`);
  if (!db.data_sources || !db.data_sources.length) {
    throw new Error("이 데이터베이스에 data source가 없습니다. DB ID를 확인하세요.");
  }
  cachedDataSourceId = db.data_sources[0].id;
  return cachedDataSourceId;
}

// 노션 페이지 -> 위젯 블록 형식
function pageToBlock(page) {
  const p = page.properties;
  const titleArr = p[PROP.title]?.title || [];
  const time = p[PROP.time]?.date || {};
  return {
    id: page.id,
    title: titleArr.map((t) => t.plain_text).join("") || "제목 없음",
    cat: p[PROP.category]?.select?.name || "etc",
    start: time.start || null,
    end: time.end || null,
    url: p[PROP.url]?.url || "",
    done: p[PROP.done]?.checkbox || false,
  };
}

// 위젯 블록 -> 노션 속성 형식
function blockToProps(b) {
  const props = {};
  if (b.title !== undefined)
    props[PROP.title] = { title: [{ text: { content: b.title } }] };
  if (b.start !== undefined && b.end !== undefined)
    props[PROP.time] = { date: { start: b.start, end: b.end } };
  if (b.cat !== undefined)
    props[PROP.category] = { select: { name: b.cat } };
  if (b.url !== undefined)
    props[PROP.url] = { url: b.url || null };
  if (b.done !== undefined)
    props[PROP.done] = { checkbox: !!b.done };
  return props;
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Sync-Secret");
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  // 선택적 비밀키 검증
  if (SYNC_SECRET) {
    const provided = req.headers["x-sync-secret"];
    if (provided !== SYNC_SECRET)
      return res.status(401).json({ error: "Unauthorized" });
  }

  if (!NOTION_TOKEN || !DATABASE_ID) {
    return res
      .status(500)
      .json({ error: "환경변수 NOTION_TOKEN / NOTION_DATABASE_ID 가 설정되지 않았습니다." });
  }

  try {
    const dsId = await getDataSourceId();

    if (req.method === "GET") {
      const data = await notion(`data_sources/${dsId}/query`, {
        method: "POST",
        body: JSON.stringify({ page_size: 100 }),
      });
      const blocks = data.results.map(pageToBlock).filter((b) => b.start);
      return res.status(200).json({ blocks });
    }

    if (req.method === "POST") {
      const b = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const created = await notion(`pages`, {
        method: "POST",
        body: JSON.stringify({
          parent: { type: "data_source_id", data_source_id: dsId },
          properties: blockToProps(b),
        }),
      });
      return res.status(200).json({ block: pageToBlock(created) });
    }

    if (req.method === "PATCH") {
      const b = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      if (!b.id) return res.status(400).json({ error: "id 필요" });
      const updated = await notion(`pages/${b.id}`, {
        method: "PATCH",
        body: JSON.stringify({ properties: blockToProps(b) }),
      });
      return res.status(200).json({ block: pageToBlock(updated) });
    }

    if (req.method === "DELETE") {
      const b = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const id = b.id || req.query.id;
      if (!id) return res.status(400).json({ error: "id 필요" });
      // 아카이브(휴지통 이동) - 복구 가능, 영구삭제 아님
      await notion(`pages/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ archived: true }),
      });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
