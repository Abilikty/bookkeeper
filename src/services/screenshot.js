/**
 * 截圖 OCR 識別服務
 *
 * 流程：
 *   1. 檢查相冊最新截圖（2分鐘內）
 *   2. ML Kit OCR 識別文字
 *   3. 提取支付金額和商戶
 *   4. 處理完刪除截圖
 */
import * as MediaLibrary from 'expo-media-library';
import { recognizeImage } from '@react-native-ml-kit/text-recognition';

let lastScan = 0;

export async function scanScreenshot() {
  try {
    // 30秒內不重複掃
    const now = Date.now();
    if (now - lastScan < 30000) return null;
    lastScan = now;

    // 請求權限
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') return null;

    // 獲取最近截圖
    const twoMinAgo = now - 2 * 60 * 1000;
    const assets = await MediaLibrary.getAssetsAsync({
      first: 10,
      sortBy: [MediaLibrary.SortBy.creationTime],
      mediaType: 'photo',
      createdAfter: twoMinAgo,
    });

    if (!assets.assets?.length) return null;

    // 找截圖
    const screenshot = assets.assets.find(a =>
      a.filename?.toLowerCase().includes('screenshot') ||
      (a.width > 500 && a.height > 800)
    );
    if (!screenshot) return null;

    console.log('📸 發現截圖:', screenshot.filename);

    // OCR
    let ocrText = '';
    try {
      const result = await recognizeImage(screenshot.uri);
      ocrText = result?.text || '';
      if (!ocrText && result?.blocks) {
        ocrText = result.blocks.map(b => b.text).join(' ');
      }
    } catch (e) {
      console.log('OCR失敗:', e.message);
      return null;
    }

    if (!ocrText) return null;

    // 提取金額
    const amount = extractAmount(ocrText);
    if (amount <= 0) return null;

    const receiver = extractReceiver(ocrText);

    // 刪截圖
    try {
      await MediaLibrary.deleteAssetsAsync([screenshot.id]);
    } catch (_) {}

    return { amount, receiver, raw: ocrText };

  } catch (err) {
    console.error(err);
    return null;
  }
}

function extractAmount(text) {
  const patterns = [
    /支付金额[¥￥]\s*(\d+\.?\d*)/,
    /付款金额[¥￥]\s*(\d+\.?\d*)/,
    /[¥￥]\s*(\d+\.\d{2})/,
    /[¥￥]\s*(\d+)/,
    /(\d+\.\d{2})\s*元/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const v = parseFloat(m[1]);
      if (v > 0.01 && v < 100000) return v;
    }
  }
  return 0;
}

function extractReceiver(text) {
  const patterns = [
    /收款方[：:]\s*(.{1,20})/,
    /商户[：:]\s*(.{1,20})/,
    /商品说明[：:]\s*(.{1,20})/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim().replace(/[\n\r]/g, '');
  }
  return '未知商戶';
}
