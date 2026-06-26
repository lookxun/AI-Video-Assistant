import { mkdirSync, rmSync, writeFileSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";

const output = join(process.cwd(), "FlashMuse_Agent_Project Planning", "图片模型尺寸测试表.docx");
const tempRoot = join(tmpdir(), `yinzao-image-size-docx-${Date.now()}`);
const zipPath = join(tmpdir(), `yinzao-image-size-docx-${Date.now()}.zip`);

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function paragraph(text, { size = 22, bold = false, spacing = 160, color = "111111" } = {}) {
  return `
    <w:p>
      <w:pPr><w:spacing w:after="${spacing}"/></w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Microsoft YaHei" w:eastAsia="Microsoft YaHei"/><w:sz w:val="${size}"/><w:color w:val="${color}"/>${bold ? "<w:b/>" : ""}</w:rPr>
        <w:t>${escapeXml(text)}</w:t>
      </w:r>
    </w:p>`;
}

function table(headers, rows, widths = []) {
  const columnWidths = headers.map((_, index) => widths[index] ?? (index === 0 ? 1200 : 2600));
  const cells = (items, header = false) => `
    <w:tr>
      ${items.map((item, index) => `
        <w:tc>
          <w:tcPr><w:tcW w:w="${columnWidths[index]}" w:type="dxa"/><w:tcBorders><w:bottom w:val="single" w:sz="4" w:space="0" w:color="E6E6E6"/></w:tcBorders><w:vAlign w:val="center"/></w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="${index === 0 ? "left" : "center"}"/><w:spacing w:after="0"/></w:pPr>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Microsoft YaHei" w:eastAsia="Microsoft YaHei"/><w:sz w:val="22"/><w:color w:val="${header || index === 0 ? "555555" : "2FC7C5"}"/>${header || index > 0 ? "<w:b/>" : ""}</w:rPr>
              <w:t>${escapeXml(item)}</w:t>
            </w:r>
          </w:p>
        </w:tc>`).join("")}
    </w:tr>`;

  return `
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="0" w:type="auto"/>
        <w:tblLayout w:type="fixed"/>
        <w:tblCellMar>
          <w:top w:w="160" w:type="dxa"/><w:left w:w="160" w:type="dxa"/><w:bottom w:w="160" w:type="dxa"/><w:right w:w="160" w:type="dxa"/>
        </w:tblCellMar>
        <w:tblBorders>
          <w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E6E6E6"/>
          <w:insideV w:val="nil"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tblGrid>${columnWidths.map((width) => `<w:gridCol w:w="${width}"/>`).join("")}</w:tblGrid>
      ${cells(headers, true)}
      ${rows.map((row) => cells(row)).join("")}
    </w:tbl>`;
}

const headers = ["比例", "1K", "2K", "4K"];
const sections = [
  {
    title: "Seedream 4.5",
    rows: [
      ["1:1", "2048×2048", "2048×2048", "4096×4096"],
      ["16:9", "2560×1440", "2560×1440", "4096×2304"],
      ["9:16", "1440×2560", "1440×2560", "2304×4096"],
      ["21:9", "3024×1296", "3024×1296", "4096×1756"],
      ["4:3", "2304×1728", "2304×1728", "4096×3072"],
      ["3:4", "1728×2304", "1728×2304", "3072×4096"],
    ],
  },
  {
    title: "Gemini 3.1 Flash",
    rows: [
      ["1:1", "1024×1024", "2048×2048", "4096×4096"],
      ["16:9", "1376×768", "2752×1536", "5504×3072"],
      ["9:16", "768×1376", "1536×2752", "3072×5504"],
      ["21:9", "1584×672", "3168×1344", "6336×2688"],
      ["4:3", "1200×896", "2400×1792", "4800×3584"],
      ["3:4", "896×1200", "1792×2400", "3584×4800"],
    ],
  },
  {
    title: "Gemini 3 Pro",
    note: "这个模型这次表现不稳定，同参数复测有些尺寸不一致。表里列的是本轮观察到的结果。",
    widths: [1200, 2200, 3600, 3600],
    rows: [
      ["1:1", "1024×1024", "1024×1024 / 2048×2048", "1024×1024"],
      ["16:9", "1376×768", "1376×768 / 2752×1536", "1376×768 / 5504×3072"],
      ["9:16", "768×1376", "768×1376", "3072×5504"],
      ["21:9", "1584×672", "3168×1344", "1584×672"],
      ["4:3", "1200×896", "1200×896 / 2400×1792", "4800×3584"],
      ["3:4", "896×1200", "896×1200", "3584×4800"],
    ],
  },
  {
    title: "GPT-5.4 Image 2",
    rows: [
      ["1:1", "1024×1024", "2048×2048", "不支持"],
      ["16:9", "1280×720", "2560×1440", "不支持"],
      ["9:16", "720×1280", "1440×2560", "不支持"],
      ["21:9", "1568×672", "3024×1296", "不支持"],
      ["4:3", "1152×864", "2304×1728", "不支持"],
      ["3:4", "864×1152", "1728×2304", "不支持"],
    ],
  },
];

const body = [
  paragraph("图片模型尺寸测试表", { size: 36, bold: true, spacing: 220 }),
  paragraph("测试参数统一为 image_config.aspect_ratio + image_config.image_size。以下尺寸为本轮实测真实输出尺寸。", { size: 22 }),
  paragraph("结论", { size: 28, bold: true }),
  paragraph("1. Seedream 4.5：1K 会按 2K 出图，2K 正常，4K 可出。"),
  paragraph("2. Gemini 3.1 Flash：1K / 2K / 4K 都可出。"),
  paragraph("3. Gemini 3 Pro：能出高尺寸，但不稳定，部分比例会忽略 image_size。"),
  paragraph("4. GPT-5.4 Image 2：只支持 1K / 2K，4K 接口直接报不支持。"),
  ...sections.flatMap((section) => [
    paragraph(section.title, { size: 28, bold: true, spacing: 140 }),
    ...(section.note ? [paragraph(section.note, { size: 20 })] : []),
    table(headers, section.rows, section.widths),
    paragraph("", { spacing: 160 }),
  ]),
  paragraph("GPT-5.4 Image 2 的 4K 报错核心：image_size: Invalid option: expected one of \"1K\"|\"2K\"。", { size: 20 }),
  paragraph("可开放档位建议", { size: 28, bold: true }),
  table(["模型", "可开放档位"], [
    ["Seedream 4.5", "2K / 4K"],
    ["Gemini 3.1 Flash", "1K / 2K / 4K"],
    ["Gemini 3 Pro", "1K / 2K / 4K（模型端不稳定，用户自行测试）"],
    ["GPT-5.4 Image 2", "1K / 2K"],
  ], [2600, 5200]),
].join("");

const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${body}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1134" w:right="850" w:bottom="1134" w:left="850" w:header="708" w:footer="708" w:gutter="0"/>
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
rmSync(output, { force: true });
copyFileSync(zipPath, output);
rmSync(tempRoot, { recursive: true, force: true });
rmSync(zipPath, { force: true });

console.log(output);
