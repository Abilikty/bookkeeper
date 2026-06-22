import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  FlatList, Modal, Alert, StyleSheet, Animated,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { parseExpense, saveExpense, getExpenses } from '../services/api';
import { cacheRecentExpenses, getCachedExpenses } from '../utils/storage';
import ExpenseCard from '../components/ExpenseCard';
import SplitDetail from '../components/SplitDetail';

function getMyShare(e) {
  return e.splits?.find(s => s.person === '我')?.share_amount || e.amount || 0;
}

export default function HomeScreen({ navigation }) {
  const [inputText, setInputText] = useState('');
  const [recentExpenses, setRecentExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [parseResult, setParseResult] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editItem, setEditItem] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [hint, setHint] = useState(null);
  const [clipSuggestion, setClipSuggestion] = useState(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const hintTimer = useRef(null);

  function showHint(type, text) {
    clearTimeout(hintTimer.current);
    setHint({ type, text });
    hintTimer.current = setTimeout(() => setHint(null), 3000);
  }

  function triggerShake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
  }

  useFocusEffect(useCallback(() => {
    loadRecent();
    checkClipboard();
  }, []));

  async function loadRecent() {
    try { const r = await getExpenses({ page: 1, limit: 20 }); setRecentExpenses(r.data || []); cacheRecentExpenses(r.data || []); }
    catch (_) { setRecentExpenses(await getCachedExpenses()); }
  }

  async function checkClipboard() {
    try {
      const text = await Clipboard.getStringAsync();
      if (!text || text.length < 3 || text.length > 200) return;
      if (/[付款支付消费]/.test(text) || /\d+\.?\d*\s*[元块¥]/.test(text) || /¥\s*\d+/.test(text)) {
        if (clipSuggestion?.text !== text) setClipSuggestion({ text });
      }
    } catch (_) {}
  }

  async function handleParse(externalText) {
    const fromExt = typeof externalText === 'string' && externalText.length > 0;
    const text = (fromExt ? externalText : inputText).trim();
    if (!text) { showHint('error', '请先输入消费描述'); triggerShake(); return; }
    if (fromExt) setInputText(externalText);
    setParsing(true);
    try {
      const r = await parseExpense(text);
      setParseResult(r); setEditAmount(String(r.amount)); setEditItem(r.item); setEditCategory(r.category);
      setModalVisible(true);
    } catch (err) { showHint('error', '解析失败: ' + err.message); }
    finally { setParsing(false); }
  }

  async function handleSave() {
    setLoading(true);
    try {
      const amount = parseFloat(editAmount);
      if (!amount || amount <= 0) { Alert.alert('错误', '金额无效'); setLoading(false); return; }
      const splits = recalc(amount, parseResult.people, parseResult.splitType);
      await saveExpense({ raw_text: parseResult.rawText, amount, item: editItem || '未知', category: editCategory || '其他', split_type: parseResult.splitType, splits, currency: parseResult.currency || 'CNY' });
      setModalVisible(false); setInputText(''); setParseResult(null);
      showHint('success', `已记录：${editItem} ¥${amount.toFixed(2)}`);
      loadRecent();
    } catch (err) { Alert.alert('保存失败', err.message); }
    finally { setLoading(false); }
  }

  function recalc(amount, people, type) {
    if (type === 'single') return [{ person: people[0] || '我', share_amount: Math.round(amount * 100) / 100 }];
    const per = Math.round((amount / people.length) * 100) / 100;
    return people.map((p, i) => ({ person: p, share_amount: i === people.length - 1 ? Math.round((amount - per * (people.length - 1)) * 100) / 100 : per }));
  }

  const myTotal = recentExpenses.reduce((s, e) => s + getMyShare(e), 0);
  const quickTags = [
    { label: '午饭', icon: 'fast-food' }, { label: '晚饭', icon: 'restaurant' },
    { label: '打车', icon: 'car' }, { label: '咖啡', icon: 'cafe' },
    { label: '超市', icon: 'cart' }, { label: '外卖', icon: 'bicycle' },
    { label: '奶茶', icon: 'wine' },
  ];

  // ====== 页面头部 (会跟随列表一起滚动) ======
  const ListHeader = (
    <View>
      {/* 汇总卡片 */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryInner}>
          <Text style={styles.summaryLabel}>本月个人支出</Text>
          <Text style={styles.summaryAmount}>¥{myTotal.toFixed(2)}</Text>
          <View style={styles.summaryRow}>
            <Ionicons name="receipt-outline" size={14} color="rgba(255,255,255,0.7)" />
            <Text style={styles.summarySub}> {recentExpenses.length} 笔记录</Text>
          </View>
        </View>
      </View>

      {/* 剪贴板横幅 */}
      {clipSuggestion && (
        <TouchableOpacity style={styles.clipBanner} activeOpacity={0.8} onPress={() => { const t = clipSuggestion.text; setClipSuggestion(null); handleParse(t); }}>
          <View style={styles.clipIconBox}><Ionicons name="clipboard" size={18} color="#4F46E5" /></View>
          <View style={{ flex: 1 }}><Text style={styles.clipTitle}>检测到付款信息</Text><Text style={styles.clipText} numberOfLines={1}>{clipSuggestion.text}</Text></View>
          <Ionicons name="arrow-forward-circle" size={24} color="#4F46E5" />
        </TouchableOpacity>
      )}

      {/* 输入卡片 */}
      <Animated.View style={[styles.inputCard, { transform: [{ translateX: shakeAnim }] }]}>
        <View style={styles.inputRow}>
          <View style={styles.inputIconBox}><Ionicons name="chatbubble-ellipses" size={20} color="#4F46E5" /></View>
          <TextInput style={styles.textInput} placeholder="午饭三人AA 120元..." placeholderTextColor="#9CA3AF"
            value={inputText} onChangeText={setInputText} autoFocus multiline={false} returnKeyType="send" onSubmitEditing={() => handleParse()} />
        </View>
        {!inputText && (
          <View style={styles.hintBox}>
            <Text style={styles.hintTitle}>💡 试试这样说</Text>
            {[{ text: '午饭三人AA 120元', icon: 'fast-food' }, { text: '打车45 我和小王一人一半', icon: 'car' }, { text: '超市买菜200 我自己付', icon: 'cart' }].map((h, i) => (
              <TouchableOpacity key={i} style={styles.hintItem} onPress={() => { setInputText(h.text); handleParse(h.text); }}>
                <Ionicons name={h.icon} size={14} color="#4F46E5" />
                <Text style={styles.hintText} numberOfLines={1}> {h.text}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        <View style={styles.quickTags}>
          {quickTags.map(t => (
            <TouchableOpacity key={t.label} style={styles.quickTag} onPress={() => setInputText(p => p + t.label)}>
              <Ionicons name={t.icon} size={13} color="#4F46E5" /><Text style={styles.quickTagText}> {t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={[styles.parseBtn, parsing && styles.parseBtnOff]} onPress={() => handleParse()} disabled={parsing} activeOpacity={0.8}>
          {parsing ? <ActivityIndicator color="#fff" /> : (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="sparkles" size={20} color="#fff" /><Text style={styles.parseBtnText}> AI 解析</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Inline 提示 */}
      {hint && (
        <View style={[styles.hintBar, hint.type === 'error' ? styles.hintError : styles.hintSuccess]}>
          <Ionicons name={hint.type === 'error' ? 'alert-circle' : 'checkmark-circle'} size={18} color={hint.type === 'error' ? '#EF4444' : '#10B981'} />
          <Text style={[styles.hintBarText, { color: hint.type === 'error' ? '#991B1B' : '#065F46' }]}> {hint.text}</Text>
        </View>
      )}

      {/* 最近账单标题 */}
      <View style={styles.recentHeader}>
        <Text style={styles.recentTitle}>最近账单</Text>
        <TouchableOpacity onPress={() => navigation.navigate('历史')}>
          <Text style={styles.viewAll}>查看全部 <Ionicons name="chevron-forward" size={14} color="#4F46E5" /></Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* 整页共用一个 FlatList：头部内容 + 账单列表，一起滚动 */}
      <FlatList
        data={recentExpenses.slice(0, 20)}
        keyExtractor={item => String(item.id)}
        ListHeaderComponent={ListHeader}
        renderItem={({ item }) => (
          <ExpenseCard expense={item} onPress={() => {
            const my = getMyShare(item);
            Alert.alert(`${item.item} · ¥${my.toFixed(2)}${item.splits?.length > 1 ? ' (我的)' : ''}`,
              item.splits?.map(s => `${s.person}: ¥${s.share_amount.toFixed(2)}`).join('\n') + `\n\n总计 ¥${item.amount.toFixed(2)}`);
          }} />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIconBox}><Ionicons name="receipt-outline" size={40} color="#9CA3AF" /></View>
            <Text style={styles.emptyText}>还没有账单记录</Text>
            <Text style={styles.emptyHint}>在上方输入描述，让 AI 帮你记账</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 20 }}
        keyboardShouldPersistTaps="handled"
      />

      {/* 确认弹窗 */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}><Text style={styles.modalCancel}>取消</Text></TouchableOpacity>
            <Text style={styles.modalTitle}>确认账单</Text>
            <TouchableOpacity onPress={handleSave} disabled={loading}>
              {loading ? <ActivityIndicator size="small" color="#4F46E5" /> : <Text style={styles.modalSave}>保存</Text>}
            </TouchableOpacity>
          </View>
          {parseResult && (
            <View style={styles.modalBody}>
              <View style={styles.sourceBadge}>
                <Ionicons name={parseResult.source === 'coze' ? 'cloud-done' : 'phone-portrait'} size={14} color="#4F46E5" />
                <Text style={styles.sourceText}> {parseResult.source === 'coze' ? 'Coze AI 解析' : '本地引擎解析'}</Text>
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}><Ionicons name="cash" size={16} color="#4F46E5" /> 金额</Text>
                <TextInput style={styles.fieldInput} value={editAmount} onChangeText={setEditAmount} keyboardType="decimal-pad" placeholder="0.00" />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}><Ionicons name="cart" size={16} color="#4F46E5" /> 商品/服务</Text>
                <TextInput style={styles.fieldInput} value={editItem} onChangeText={setEditItem} />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}><Ionicons name="pricetags" size={16} color="#4F46E5" /> 分类</Text>
                <View style={styles.catRow}>
                  {['餐饮', '交通', '购物', '娱乐', '居住', '其他'].map(cat => (
                    <TouchableOpacity key={cat} style={[styles.catBtn, editCategory === cat && styles.catBtnActive]} onPress={() => setEditCategory(cat)}>
                      <Text style={[styles.catBtnText, editCategory === cat && styles.catBtnTextActive]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <SplitDetail splits={recalc(parseFloat(editAmount) || parseResult.amount, parseResult.people, parseResult.splitType)} totalAmount={parseFloat(editAmount) || parseResult.amount} splitType={parseResult.splitType} />
            </View>
          )}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  // 剪贴板
  clipBanner: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 4, padding: 14, borderRadius: 16, backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: '#C7D2FE' },
  clipIconBox: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#C7D2FE', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  clipTitle: { fontSize: 13, fontWeight: '700', color: '#4F46E5' },
  clipText: { fontSize: 12, color: '#6366F1', marginTop: 2 },
  // 汇总
  summaryCard: { marginHorizontal: 16, marginTop: 12, marginBottom: 4, borderRadius: 18, backgroundColor: '#4F46E5', shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  summaryInner: { padding: 22, alignItems: 'center' },
  summaryLabel: { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  summaryAmount: { fontSize: 36, fontWeight: '800', color: '#fff', marginVertical: 6 },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summarySub: { fontSize: 13, color: 'rgba(255,255,255,0.65)' },
  // 输入
  inputCard: { backgroundColor: '#fff', marginHorizontal: 16, marginVertical: 10, padding: 18, borderRadius: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 3 },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  inputIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  textInput: { flex: 1, fontSize: 16, color: '#1F2937', padding: 0 },
  hintBox: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  hintTitle: { fontSize: 12, color: '#9CA3AF', fontWeight: '500', marginBottom: 8 },
  hintItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#F8FAFC', borderRadius: 10, marginBottom: 4 },
  hintText: { fontSize: 13, color: '#4F46E5', flex: 1 },
  quickTags: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14, gap: 8 },
  quickTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  quickTagText: { fontSize: 12, color: '#4F46E5', fontWeight: '500' },
  parseBtn: { backgroundColor: '#4F46E5', borderRadius: 14, padding: 15, alignItems: 'center', marginTop: 14 },
  parseBtnOff: { backgroundColor: '#A5B4FC' },
  parseBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  hintBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, padding: 14, borderRadius: 14, marginTop: 2 },
  hintError: { backgroundColor: '#FEF2F2' },
  hintSuccess: { backgroundColor: '#ECFDF5' },
  hintBarText: { fontSize: 14, fontWeight: '500', flex: 1 },
  // 最近
  recentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 16, marginTop: 18, marginBottom: 8 },
  recentTitle: { fontSize: 17, fontWeight: '700', color: '#1F2937' },
  viewAll: { fontSize: 13, color: '#4F46E5', fontWeight: '500' },
  // 空白
  empty: { alignItems: 'center', padding: 50 },
  emptyIconBox: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#6B7280' },
  emptyHint: { fontSize: 13, color: '#9CA3AF', marginTop: 6 },
  // 弹窗
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  modalCancel: { fontSize: 16, color: '#6B7280' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#1F2937' },
  modalSave: { fontSize: 16, fontWeight: '700', color: '#4F46E5' },
  modalBody: { padding: 20 },
  sourceBadge: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: '#EEF2FF', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginBottom: 20 },
  sourceText: { fontSize: 13, color: '#4F46E5', fontWeight: '500' },
  fieldGroup: { marginBottom: 16 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
  fieldInput: { fontSize: 16, borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 12, padding: 14, color: '#1F2937', backgroundColor: '#F8FAFC' },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  catBtnActive: { borderColor: '#4F46E5', backgroundColor: '#EEF2FF' },
  catBtnText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  catBtnTextActive: { color: '#4F46E5', fontWeight: '700' },
});
