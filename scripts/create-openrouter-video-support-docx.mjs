import { copyFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

const planningDir = join(process.cwd(), "FlashMuse_Agent_Project Planning");
const outputPath = join(planningDir, "openrouter 视频模型支持比例和分辨率.docx");
const tempRoot = join(tmpdir(), `yinzao-openrouter-video-support-${Date.now()}`);
const zipPath = join(tmpdir(), `yinzao-openrouter-video-support-${Date.now()}.zip`);

const rows = [
  ["Seedance 2.0 Fast", "480p / 720p", "1:1 / 3:4 / 9:16 / 4:3 / 16:9 / 21:9 / 9:21"],
  ["Seedance 2.0", "480p / 720p / 1080p", "1:1 / 3:4 / 9:16 / 4:3 / 16:9 / 21:9 / 9:21"],
  ["Kling v3.0 Standard", "720p", "16:9 / 9:16 / 1:1"],
  ["Kling v3.0 Pro", "720p", "16:9 / 9:16 / 1:1"],
  ["Kling Video O1", "720p", "16:9 / 9:16 / 1:1"],
  ["Veo 3.1", "720p / 1080p / 4K", "16:9 / 9:16"],
];

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function run(text, { color = "555555", bold = false, size = 24 } = {}) {
  return `<w:r><w:rPr><w:rFonts w:ascii="Microsoft YaHei" w:eastAsia="Microsoft YaHei"/><w:sz w:val="${size}"/><w:color w:val="${color}"/>${bold ? "<w:b/>" : ""}</w:rPr><w:t>${escapeXml(text)}</w:t></w:r>`;
}

function paragraph(text, { size = 34, bold = true, color = "333333", spacing = 260 } = {}) {
  return `<w:p><w:pPr><w:spacing w:after="${spacing}"/></w:pPr>${run(text, { size, bold, color })}</w:p>`;
}

function cell(text, { header = false, accent = false, width = 3000 } = {}) {
  const color = header ? "666666" : accent ? "2FC7C5" : "555555";
  const size = header ? 22 : 24;
  return `<w:tc>
    <w:tcPr>
      <w:tcW w:w="${width}" w:type="dxa"/>
      <w:tcBorders><w:bottom w:val="single" w:sz="4" w:space="0" w:color="E6E6E6"/></w:tcBorders>
      <w:vAlign w:val="center"/>
    </w:tcPr>
    <w:p><w:pPr><w:jc w:val="left"/><w:spacing w:after="0"/></w:pPr>${run(text, { color, bold: header || accent, size })}</w:p>
  </w:tc>`;
}

function table() {
  const widths = [3200, 3000, 6300];
  const header = ["模型", "分辨率按钮", "比例按钮"];
  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="12500" w:type="dxa"/>
      <w:tblLayout w:type="fixed"/>
      <w:tblCellMar>
        <w:top w:w="180" w:type="dxa"/><w:left w:w="180" w:type="dxa"/><w:bottom w:w="180" w:type="dxa"/><w:right w:w="180" w:type="dxa"/>
      </w:tblCellMar>
      <w:tblBorders>
        <w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E6E6E6"/>
        <w:insideV w:val="nil"/>
      </w:tblBorders>
    </w:tblPr>
    <w:tblGrid>${widths.map((width) => `<w:gridCol w:w="${width}"/>`).join("")}</w:tblGrid>
    <w:tr>${header.map((item, index) => cell(item, { header: true, width: widths[index] })).join("")}</w:tr>
    ${rows.map((row) => `<w:tr>${row.map((item, index) => cell(item, { accent: index > 0, width: widths[index] })).join("")}</w:tr>`).join("")}
  </w:tbl>`;
}

const body = [
  paragraph("openrouter 视频模型支持比例和分辨率"),
  table(),
].join("");

const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${body}
    <w:sectPr>
      <w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>
      <w:pgMar w:top="850" w:right="900" w:bottom="850" w:left="900" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

rmSync(tempRoot, { recursive: true, force: true });
mkdirSync(join(tempRoot, "_rels"), { recursive: true });
mkdirSync(join(tempRoot, "word"), { recursive: true });

writeFileSync(join(tempRoot, "[Content_Types].xml"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);

writeFileSync(join(tempRoot, "_rels", ".rels"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
writeFileSync(join(tempRoot, "word", "document.xml"), documentXml);

rmSync(zipPath, { force: true });
execFileSync("powershell.exe", ["-NoProfile", "-Command", `Compress-Archive -LiteralPath '${join(tempRoot, "[Content_Types].xml")}', '${join(tempRoot, "_rels")}', '${join(tempRoot, "word")}' -DestinationPath '${zipPath}' -Force`]);
rmSync(outputPath, { force: true });
copyFileSync(zipPath, outputPath);
rmSync(tempRoot, { recursive: true, force: true });
rmSync(zipPath, { force: true });

console.log(outputPath);
