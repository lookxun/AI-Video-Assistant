import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

const planningDir = join(process.cwd(), "FlashMuse_Agent_Project Planning");
const inputPath = join(planningDir, "test", "video-model-test-raw.json");
const outputPath = join(planningDir, "视频模型测试结果表.docx");
const tempRoot = join(tmpdir(), `yinzao-video-test-docx-${Date.now()}`);
const zipPath = join(tmpdir(), `yinzao-video-test-docx-${Date.now()}.zip`);

const modelOrder = ["Seedance 2.0 Fast", "Seedance 2.0", "Kling v3.0 Standard", "Kling v3.0 Pro", "Kling Video O1", "Veo 3.1"];
const resolutionOrder = ["480p", "720p", "1080p", "4K"];
const ratioOrder = ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16", "9:21"];

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function textRun(text, { bold = false, color = "111111", size = 21 } = {}) {
  return `<w:r><w:rPr><w:rFonts w:ascii="Microsoft YaHei" w:eastAsia="Microsoft YaHei"/><w:sz w:val="${size}"/><w:color w:val="${color}"/>${bold ? "<w:b/>" : ""}</w:rPr><w:t>${escapeXml(text)}</w:t></w:r>`;
}

function paragraph(text, { size = 22, bold = false, color = "111111", spacing = 140 } = {}) {
  return `<w:p><w:pPr><w:spacing w:after="${spacing}"/></w:pPr>${textRun(text, { size, bold, color })}</w:p>`;
}

function cell(content, { header = false, red = false, width = 1600, align = "center" } = {}) {
  const color = red ? "D9001B" : "111111";
  return `<w:tc>
    <w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:tcBorders><w:bottom w:val="single" w:sz="4" w:space="0" w:color="E6E6E6"/></w:tcBorders><w:vAlign w:val="center"/></w:tcPr>
    <w:p><w:pPr><w:jc w:val="${align}"/><w:spacing w:after="0"/></w:pPr>${textRun(content, { bold: header, color, size: 21 })}</w:p>
  </w:tc>`;
}

function table(headers, rows, widths) {
  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="14900" w:type="dxa"/>
      <w:tblLayout w:type="fixed"/>
      <w:tblCellMar>
        <w:top w:w="150" w:type="dxa"/><w:left w:w="140" w:type="dxa"/><w:bottom w:w="150" w:type="dxa"/><w:right w:w="140" w:type="dxa"/>
      </w:tblCellMar>
      <w:tblBorders>
        <w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E6E6E6"/>
        <w:insideV w:val="nil"/>
      </w:tblBorders>
    </w:tblPr>
    <w:tblGrid>${widths.map((width) => `<w:gridCol w:w="${width}"/>`).join("")}</w:tblGrid>
    <w:tr>${headers.map((item, index) => cell(item, { header: true, width: widths[index], align: index === 0 ? "left" : "center" })).join("")}</w:tr>
    ${rows.map((row) => `<w:tr>${row.map((item, index) => cell(item.text, { red: item.red, width: widths[index], align: index === 0 ? "left" : "center" })).join("")}</w:tr>`).join("")}
  </w:tbl>`;
}

function rank(value, list) {
  const index = list.indexOf(value);
  return index === -1 ? 999 : index;
}

function isWrong(value) {
  return value === "不一致" || value === "失败";
}

const results = JSON.parse(readFileSync(inputPath, "utf8"));
const sortedResults = [...results].sort((a, b) => {
  const modelDiff = rank(a.label, modelOrder) - rank(b.label, modelOrder);
  if (modelDiff) return modelDiff;
  const resolutionDiff = rank(a.request?.resolution, resolutionOrder) - rank(b.request?.resolution, resolutionOrder);
  if (resolutionDiff) return resolutionDiff;
  return rank(a.request?.ratio, ratioOrder) - rank(b.request?.ratio, ratioOrder);
});

const rows = sortedResults.map((item) => {
  const outputSize = item.outputSize || "失败";
  const outputRatio = item.outputRatio || "失败";
  const ratioMatch = item.ratioMatch || "失败";
  const sizeMatch = item.sizeMatch || "失败";
  return [
    { text: item.label },
    { text: item.request?.resolution ?? "" },
    { text: item.request?.ratio ?? "" },
    { text: item.request?.size ?? "" },
    { text: outputSize, red: isWrong(sizeMatch) },
    { text: outputRatio, red: isWrong(ratioMatch) },
    { text: ratioMatch, red: isWrong(ratioMatch) },
    { text: sizeMatch, red: isWrong(sizeMatch) },
  ];
});

const total = results.length;
const success = results.filter((item) => !item.error).length;
const failed = total - success;
const ratioOk = results.filter((item) => item.ratioMatch === "一致").length;
const sizeOk = results.filter((item) => item.sizeMatch === "一致").length;

const body = [
  paragraph("视频模型测试结果表", { size: 34, bold: true, spacing: 180 }),
  paragraph(`测试范围：当前接入视频模型，不含智能比例，不按时长分类，统一使用最短时长。总计 ${total} 次，成功 ${success} 次，失败 ${failed} 次。`, { size: 21 }),
  paragraph(`比例一致：${ratioOk} / ${success}；尺寸一致：${sizeOk} / ${success}。红字表示失败或不一致。`, { size: 21 }),
  table(["模型", "分辨率", "比例", "请求/UI尺寸", "实际输出", "输出比例", "比例", "尺寸"], rows, [3400, 1500, 1200, 2200, 2200, 1500, 1200, 1200]),
].join("");

const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${body}
    <w:sectPr>
      <w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>
      <w:pgMar w:top="500" w:right="360" w:bottom="500" w:left="360" w:header="500" w:footer="500" w:gutter="0"/>
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
