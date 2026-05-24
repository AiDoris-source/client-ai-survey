/**
 * 腾讯文档智能表格提交桥接服务
 * HTML 表单 POST → 本服务 → mcporter → 腾讯文档智能表格
 *
 * 启动：node submit_bridge.js
 * 端口：8765
 */

const http = require('http');
const { execFile } = require('child_process');

const FILE_ID = 'BcxwANRljuVp';
const SHEET_ID = 't00i2h';

// 字段映射：HTML 表单 JSON key → 智能表格列名
const FIELD_MAP = [
  '企业名称', '所属行业', '企业规模', '业务负责人', '客户邮箱', '客户手机',
  '预算范围', '预计启动时间', '现有工具',
  'AI知识库_是否需要', 'AI知识库_优先级', 'AI知识库_补充说明',
  '发圈助手_是否需要', '发圈助手_优先级', '发圈助手_补充说明',
  '绩效助手_是否需要', '绩效助手_优先级', '绩效助手_补充说明',
  '获客助手_是否需要', '获客助手_优先级', '获客助手_补充说明',
  '企微迁移_是否需要', '企微迁移_优先级', '企微迁移_补充说明',
  '知识库_文档数量', '知识库_权限隔离', '知识库_敏感数据', '知识库_视频字幕',
  '绩效助手_目标效果', '绩效助手_心跳机制', '绩效助手_隐私数据',
  '成功标准', '硬性时间节点', '合规要求', '其他需求', '下一步期望', '提交时间',
];

function buildRecord(data) {
  const fieldValues = [];
  for (const f of FIELD_MAP) {
    const val = (data[f] || '').toString().substring(0, 3000);
    fieldValues.push({
      field: f,
      text_value: { items: [{ text: val, type: 'text' }] }
    });
  }
  return { field_values: fieldValues };
}

async function addRecord(data) {
  const record = buildRecord(data);
  const args = JSON.stringify({
    file_id: FILE_ID,
    sheet_id: SHEET_ID,
    records: [record],
  });

  return new Promise((resolve, reject) => {
    execFile('npx', ['mcporter', 'call', 'tencent-docs', 'smartsheet.add_records', '--args', args], {
      timeout: 30000,
      maxBuffer: 1024 * 1024,
      env: { ...process.env, NODE_TLS_REJECT_UNAUTHORIZED: '0' },
    }, (err, stdout, stderr) => {
      if (err) return reject(err);
      try {
        const lines = stdout.split('\n');
        const jsonLine = lines.find(l => l.trim().startsWith('{'));
        const result = JSON.parse(jsonLine);
        if (result.error) return reject(new Error(result.error));
        resolve(result);
      } catch (e) {
        reject(e);
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method !== 'POST' || req.url !== '/submit') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h2>🟢 表单桥接服务运行中</h2><p>POST /submit 接收表单数据</p>');
    return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', async () => {
    try {
      const data = JSON.parse(body);
      console.log('[收到]', data['企业名称'] || '(无企业名)');

      const result = await addRecord(data);
      console.log('[写入成功]', JSON.stringify(result).substring(0, 200));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, record_id: result.records?.[0]?.record_id }));
    } catch (e) {
      console.error('[写入失败]', e.message);

      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
  });
});

server.listen(8765, () => {
  console.log('🚀 表单桥接服务已启动 → http://localhost:8765');
  console.log('   POST /submit 接收数据 → 写入腾讯文档智能表格');
  console.log(`   表格: https://docs.qq.com/smartsheet/DQmN4d0FOUmxqdVZw`);
  console.log('   按 Ctrl+C 停止');
});
