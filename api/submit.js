// Vercel Serverless Function: 接收客户表单 → 写入腾讯文档智能表格

const API_BASE = 'https://docs.qq.com/openapi/mcp';
const AUTH_TOKEN = 'c5740f5711d94f1390212a5f0717b01d';
const REQUEST_SIGN = 'q0441b1fd76f9dbd719aa70ce7eb5fc550293b1a5b8dc35b6e023b68476d51665';
const FILE_ID = 'BcxwANRljuVp';
const SHEET_ID = 't00i2h';

// 字段名映射：表单字段 → 腾讯文档字段名（必须与表格列名完全一致）
const FIELD_ORDER = [
  '企业名称', '所属行业', '企业规模', '业务负责人', '客户邮箱', '客户手机',
  '预算范围', '预计启动时间', '现有工具',
  'AI知识库_是否需要', 'AI知识库_优先级', 'AI知识库_补充说明',
  '发圈助手_是否需要', '发圈助手_优先级', '发圈助手_补充说明',
  '绩效助手_是否需要', '绩效助手_优先级', '绩效助手_补充说明',
  '获客助手_是否需要', '获客助手_优先级', '获客助手_补充说明',
  '企微迁移_是否需要', '企微迁移_优先级', '企微迁移_补充说明',
  '知识库_文档数量', '知识库_权限隔离', '知识库_敏感数据', '知识库_视频字幕',
  '绩效助手_目标效果', '绩效助手_心跳机制', '绩效助手_隐私数据',
  '成功标准', '硬性时间节点', '合规要求', '其他需求',
  '下一步期望', '提交时间'
];

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true, message: 'Bridge service running' });
  }

  const data = req.body;

  // 转换表单数据为 smartSheet field_values 格式
  const field_values = [];
  for (const fieldName of FIELD_ORDER) {
    const value = (data[fieldName] || '').trim();
    if (value) {
      field_values.push({
        field: fieldName,
        text_value: { items: [{ text: value, type: 'text' }] }
      });
    }
  }

  const mcpPayload = {
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'smartsheet.add_records',
      arguments: {
        file_id: FILE_ID,
        sheet_id: SHEET_ID,
        records: [{ field_values }]
      }
    },
    id: 1
  };

  try {
    const apiRes = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': AUTH_TOKEN,
        'X-MCP-Request-Sign': REQUEST_SIGN
      },
      body: JSON.stringify(mcpPayload),
      signal: AbortSignal.timeout(10000)
    });

    const result = await apiRes.json();
    const content = result?.result?.content?.[0]?.text;
    if (content) {
      const parsed = JSON.parse(content);
      if (parsed.error) {
        return res.status(200).json({ ok: false, error: parsed.error });
      }
      return res.status(200).json({
        ok: true,
        record_id: parsed.records?.[0]?.record_id
      });
    }

    return res.status(200).json({ ok: false, error: 'API response parse failed' });
  } catch (e) {
    return res.status(200).json({ ok: false, error: e.message });
  }
}
