import { describe, expect, it } from "vitest";
import { decausativize, parseQuickAdd, type ParseMember, type ParseProject } from "@/lib/nlp/tr-parser";

// Thursday, 1 October 2026, 08:30 in Istanbul.
const NOW = new Date("2026-10-01T05:30:00Z");

const MEMBERS: ParseMember[] = [
  { id: "ayse", name: "Ayşe Yılmaz" },
  { id: "burak", name: "Burak Erol" },
  { id: "mehmet", name: "Mehmet Demir" },
  { id: "ismail", name: "İsmail Öztürk" },
];
const TWO_AYSE: ParseMember[] = [...MEMBERS, { id: "ayse2", name: "Ayşe Kara" }];
const PROJECTS: ParseProject[] = [
  { id: "web", name: "Web Sitesi" },
  { id: "sosyal", name: "Sosyal Medya" },
  { id: "icerik", name: "İçerik Takvimi" },
];

const parse = (text: string, members: ParseMember[] = MEMBERS) =>
  parseQuickAdd(text, { now: NOW, members, projects: PROJECTS });

describe("spec examples", () => {
  it("parses the canonical delegation sentence", () => {
    const r = parse("Yarın saat 14'te Ayşe'ye Instagram postunu hazırlat");
    expect(r).toMatchObject({
      title: "Instagram postunu hazırla",
      dueDate: "2026-10-02",
      dueTime: "14:00",
      assigneeIds: ["ayse"],
    });
    expect(r.highlights.map((h) => h.kind)).toEqual(["date", "time", "assignee"]);
    expect(r.confidence).toBe(1);
  });

  it("handles compound causative 'kontrol ettir'", () => {
    const r = parse("Yarın saat 14'te Burak'a landing page'i kontrol ettir");
    expect(r.title).toBe("Landing page'i kontrol et");
    expect(r.assigneeIds).toEqual(["burak"]);
    expect(r.dueTime).toBe("14:00");
  });
});

describe("assignees", () => {
  it("dative + plain verb = recipient, not assignee", () => {
    const r = parse("Burak'a mail at");
    expect(r.assigneeIds).toEqual([]);
    expect(r.title).toBe("Burak'a mail at");
  });
  it("lexicalised 'anlat' is not causative", () => {
    expect(parse("Ayşe'ye durumu anlat").assigneeIds).toEqual([]);
  });
  it("explicit @mention always assigns", () => {
    const r = parse("@mehmet raporu hazırla");
    expect(r.assigneeIds).toEqual(["mehmet"]);
    expect(r.title).toBe("Raporu hazırla");
  });
  it("@mention + causative verb is de-causativised", () => {
    expect(parse("@ayşe raporu hazırlat").title).toBe("Raporu hazırla");
  });
  it("@mention without Turkish letters still matches", () => {
    expect(parse("@ayse raporu hazırla").assigneeIds).toEqual(["ayse"]);
  });
  it("capital İ names resolve", () => {
    const r = parse("İsmail'e sunumu hazırlat");
    expect(r.assigneeIds).toEqual(["ismail"]);
    expect(r.title).toBe("Sunumu hazırla");
  });
  it("ambiguous first name is flagged, not guessed", () => {
    const r = parse("Ayşe'ye raporu hazırlat", TWO_AYSE);
    expect(r.assigneeIds).toEqual([]);
    expect(r.ambiguous).toHaveLength(1);
    expect(r.ambiguous[0]!.candidates.map((c) => c.id).sort()).toEqual(["ayse", "ayse2"]);
    expect(r.confidence).toBeLessThan(0.7);
    expect(r.title).toBe("Raporu hazırla");
  });
  it("full name disambiguates", () => {
    const r = parse("Ayşe Kara'ya raporu yazdır", TWO_AYSE);
    expect(r.assigneeIds).toEqual(["ayse2"]);
    expect(r.title).toBe("Raporu yaz");
  });
  it("'değiştir' (ş-stem) stays a plain verb", () => {
    const r = parse("Mehmet'e logoyu değiştir");
    expect(r.assigneeIds).toEqual([]);
    expect(r.title).toBe("Mehmet'e logoyu değiştir");
  });
  it("-rt causative", () => {
    const r = parse("Burak'a sözleşmeyi göndert");
    expect(r.assigneeIds).toEqual(["burak"]);
    expect(r.title).toBe("Sözleşmeyi gönder");
  });
  it("'doldur' is lexicalised", () => {
    expect(parse("Ayşe'ye formu doldur").assigneeIds).toEqual([]);
  });
  it("-tir causative", () => {
    const r = parse("Mehmet'e videoyu çektir");
    expect(r.assigneeIds).toEqual(["mehmet"]);
    expect(r.title).toBe("Videoyu çek");
  });
  it("unknown names stay in the title", () => {
    const r = parse("Trendyol'a ürünleri yükle");
    expect(r.assigneeIds).toEqual([]);
    expect(r.title).toBe("Trendyol'a ürünleri yükle");
  });
  it("causative verb without a doer is left alone", () => {
    expect(parse("kontrol ettir").title).toBe("Kontrol ettir");
    expect(parse("3 gün sonra hatırlat").title).toBe("Hatırlat");
  });
  it("two @mentions", () => {
    expect(parse("@ayşe @burak ortak sunum").assigneeIds).toEqual(["ayse", "burak"]);
  });
});

describe("relative dates", () => {
  const cases: Array<[string, string]> = [
    ["bugün faturayı gönder", "2026-10-01"],
    ["yarına kadar sunumu bitir", "2026-10-02"],
    ["öbür gün toplantı notlarını paylaş", "2026-10-03"],
    ["Ertesi gün kontrol", "2026-10-03"],
    ["dün unutulan iş", "2026-09-30"],
    ["cuma bülteni yayınla", "2026-10-02"],
    ["perşembe haftalık rapor", "2026-10-01"],
    ["salıya kadar teklif hazırla", "2026-10-06"],
    ["pazartesi günü kickoff", "2026-10-05"],
    ["cumartesi etkinlik", "2026-10-03"],
    ["pazar yürüyüş", "2026-10-04"],
    ["çarşambaya sunum", "2026-10-07"],
    ["gelecek cuma demo", "2026-10-02"],
    ["önümüzdeki perşembe demo", "2026-10-08"],
    ["haftaya cuma demo", "2026-10-09"],
    ["gelecek haftanın salısı retro", "2026-10-06"],
    ["bu perşembe", "2026-10-01"],
    ["bu salı brief", "2026-10-06"],
    ["haftaya rapor", "2026-10-08"],
    ["gelecek hafta planlama", "2026-10-05"],
    ["bu hafta içinde logo revizyonu", "2026-10-02"],
    ["hafta sonu kod temizliği", "2026-10-03"],
    ["ay sonuna kadar KDV beyannamesi", "2026-10-31"],
    ["ay başına kadar bütçe", "2026-11-01"],
    ["gelecek ay bütçe", "2026-11-01"],
    ["3 gün sonra takip", "2026-10-04"],
    ["bir hafta sonra takip", "2026-10-08"],
    ["on gün sonra kontrol", "2026-10-11"],
    ["2 ay içinde yeni site", "2026-12-01"],
  ];
  it.each(cases)("%s → %s", (text, expected) => {
    expect(parse(text).dueDate).toBe(expected);
  });

  it("removes date words from the title", () => {
    expect(parse("salıya kadar teklif hazırla").title).toBe("Teklif hazırla");
    expect(parse("pazartesi günü kickoff").title).toBe("Kickoff");
    expect(parse("ay sonuna kadar KDV beyannamesi").title).toBe("KDV beyannamesi");
  });
  it("does not confuse 'dünya' with 'dün'", () => {
    expect(parse("dünya turu planı").dueDate).toBeNull();
  });
});

describe("absolute dates", () => {
  const cases: Array<[string, string | null]> = [
    ["15 ekim lansman", "2026-10-15"],
    ["15 Ekim'de lansman", "2026-10-15"],
    ["3 mart 2027 vergi", "2027-03-03"],
    ["5 eylül raporu", "2027-09-05"],
    ["20 aralığa kadar kapanış", "2026-12-20"],
    ["2 ocakta yıllık plan", "2027-01-02"],
    ["15.10 teslim", "2026-10-15"],
    ["15.10.2026'da teslim", "2026-10-15"],
    ["01/11 kampanya", "2026-11-01"],
    ["31.02 geçersiz", null],
    ["29 şubat 2027 test", null],
  ];
  it.each(cases)("%s → %s", (text, expected) => {
    expect(parse(text).dueDate).toBe(expected);
  });
  it("keeps invalid dates in the title", () => {
    expect(parse("31.02 geçersiz").title).toBe("31.02 geçersiz");
  });
  it("'saat 10.05' is a time, not 10 May", () => {
    const r = parse("saat 10.05 arama");
    expect(r.dueTime).toBe("10:05");
    expect(r.dueDate).toBe("2026-10-01");
  });
});

describe("times", () => {
  it("HH:MM", () => {
    expect(parse("yarın 14:30 toplantı")).toMatchObject({ dueDate: "2026-10-02", dueTime: "14:30", title: "Toplantı" });
  });
  it("day part after a date sets a default hour", () => {
    expect(parse("yarın sabah stand-up")).toMatchObject({ dueTime: "09:00", title: "Stand-up" });
    expect(parse("yarın öğleden sonra müşteri araması")).toMatchObject({ dueTime: "15:00", title: "Müşteri araması" });
    expect(parse("yarın akşam")).toMatchObject({ dueTime: "18:00" });
  });
  it("day part + hour → pm", () => {
    expect(parse("yarın akşam 7'de yemek")).toMatchObject({ dueDate: "2026-10-02", dueTime: "19:00", title: "Yemek" });
    expect(parse("akşam 8'de maç")).toMatchObject({ dueDate: "2026-10-01", dueTime: "20:00", title: "Maç" });
  });
  it("day part without a date stays in the title", () => {
    const r = parse("sabah toplantısını hazırla");
    expect(r.dueTime).toBeNull();
    expect(r.title).toBe("Sabah toplantısını hazırla");
    expect(r.confidence).toBeLessThan(1);
  });
  it("business-hours heuristic for 1–7", () => {
    expect(parse("saat 3 müşteri").dueTime).toBe("15:00");
    expect(parse("saat 9 standup").dueTime).toBe("09:00");
  });
  it("time-only defaults to today when still ahead, else tomorrow", () => {
    expect(parse("14'te sunum")).toMatchObject({ dueDate: "2026-10-01", dueTime: "14:00", title: "Sunum" });
    expect(parse("saat 08:00 kahvaltı")).toMatchObject({ dueDate: "2026-10-02", dueTime: "08:00" });
  });
  it("'3'e böl' is not a time", () => {
    const r = parse("listeyi 3'e böl");
    expect(r.dueTime).toBeNull();
    expect(r.title).toBe("Listeyi 3'e böl");
  });
  it("'17'ye kadar' is a deadline time", () => {
    expect(parse("17'ye kadar bitir")).toMatchObject({ dueTime: "17:00", title: "Bitir" });
  });
  it("rejects impossible times", () => {
    expect(parse("saat 25 test").dueTime).toBeNull();
  });
});

describe("priority and projects", () => {
  it("!! = high, !!! = urgent", () => {
    expect(parse("!! sunucu yedeği")).toMatchObject({ priority: "high", title: "Sunucu yedeği" });
    expect(parse("!!! canlı hata")).toMatchObject({ priority: "urgent", title: "Canlı hata" });
  });
  it("#project by normalised name or prefix", () => {
    expect(parse("#websitesi footer düzelt")).toMatchObject({ projectId: "web", title: "Footer düzelt" });
    expect(parse("#sosyal kampanya görselleri").projectId).toBe("sosyal");
    expect(parse("#içerik ekim planı").projectId).toBe("icerik");
  });
  it("unknown #hashtag stays as content", () => {
    const r = parse("#ramazan kampanyası");
    expect(r.projectId).toBeNull();
    expect(r.title).toBe("#ramazan kampanyası");
  });
  it("everything at once", () => {
    const r = parse("@burak #web yarın 10:00 !! deploy");
    expect(r).toMatchObject({
      assigneeIds: ["burak"],
      projectId: "web",
      dueDate: "2026-10-02",
      dueTime: "10:00",
      priority: "high",
      title: "Deploy",
    });
  });
});

describe("title hygiene", () => {
  it("Turkish capitalisation", () => {
    expect(parse("ilk taslak").title).toBe("İlk taslak");
  });
  it("falls back to the raw text if everything was consumed", () => {
    expect(parse("yarın").title).toBe("Yarın");
  });
  it("highlight spans point into the original text", () => {
    const text = "Yarın saat 14'te Ayşe'ye rapor hazırlat";
    const r = parse(text);
    const slices = r.highlights.map((h) => text.slice(h.start, h.end));
    expect(slices).toEqual(["Yarın", "saat 14'te", "Ayşe'ye"]);
  });
});

describe("decausativize", () => {
  const cases: Array<[string, string | null]> = [
    ["yaptır", "yap"],
    ["yazdır", "yaz"],
    ["hazırlat", "hazırla"],
    ["temizlet", "temizle"],
    ["ettir", "et"],
    ["okut", "oku"],
    ["göndert", "gönder"],
    ["sildir", "sil"],
    ["düzelttir", "düzelt"],
    ["anlat", null],
    ["değiştir", null],
    ["bitir", null],
    ["bildir", null],
    ["gönder", null],
  ];
  it.each(cases)("%s → %s", (word, expected) => {
    expect(decausativize(word)).toBe(expected);
  });
});

describe("dismissed kinds", () => {
  it("keeps the words in the title when a kind is disabled", () => {
    const r = parseQuickAdd("Yarın Ayşe'ye raporu hazırlat", { now: NOW, members: MEMBERS, disable: ["date"] });
    expect(r.dueDate).toBeNull();
    expect(r.title).toBe("Yarın raporu hazırla");
    const r2 = parseQuickAdd("Yarın Ayşe'ye raporu hazırlat", { now: NOW, members: MEMBERS, disable: ["assignee"] });
    expect(r2.assigneeIds).toEqual([]);
    expect(r2.title).toBe("Ayşe'ye raporu hazırlat");
  });
});
