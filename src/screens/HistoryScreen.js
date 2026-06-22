import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  Alert, StyleSheet, RefreshControl, Modal, ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getExpenses, deleteExpense, updateExpense } from '../services/api';
import ExpenseCard from '../components/ExpenseCard';
import SplitDetail from '../components/SplitDetail';

export default function HistoryScreen() {
  const [expenses, setExpenses] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState(null);
  const [detailModal, setDetailModal] = useState(null);
  // 编辑态
  const [editModal, setEditModal] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editItem, setEditItem] = useState('');
  const [editCategory, setEditCategory] = useState('');

  const categories = ['全部', '餐饮', '交通', '购物', '娱乐', '居住', '其他'];

  useFocusEffect(useCallback(() => { loadExpenses(1, true); }, [filter]));

  async function loadExpenses(p = 1, reset = false) {
    if (loading && !reset) return;
    setLoading(true);
    try {
      const result = await getExpenses({ page: p, limit: 20, category: filter });
      setExpenses(reset ? (result.data || []) : [...expenses, ...(result.data || [])]);
      setPage(p);
      setTotalPages(result.totalPages || 1);
    } catch (err) { Alert.alert('加载失败', err.message); }
    finally { setLoading(false); setRefreshing(false); }
  }

  async function handleDelete(id) {
    Alert.alert('删除确认', '确定要删除这条账单吗？', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: async () => {
        try { await deleteExpense(id); setExpenses(prev => prev.filter(e => e.id !== id)); }
        catch (err) { Alert.alert('删除失败', err.message); }
      }},
    ]);
  }

  function openEdit(expense) {
    setDetailModal(null);
    setEditAmount(String(expense.amount));
    setEditItem(expense.item);
    setEditCategory(expense.category);
    setEditModal(expense);
  }

  async function handleSaveEdit() {
    const amount = parseFloat(editAmount);
    if (!amount || amount <= 0) { Alert.alert('错误', '请输入有效金额'); return; }

    const orig = editModal;
    const people = orig.splits.map(s => s.person);
    const n = people.length;

    // 重新计算每人份额
    let splits;
    if (orig.split_type === 'single' || n <= 1) {
      splits = people.map(p => ({ person: p, share_amount: Math.round(amount * 100) / 100 }));
    } else {
      // equal: 每人 = 总额 / 人数，最后一人补齐差额
      const per = Math.round((amount / n) * 100) / 100;
      splits = people.map((p, i) => ({
        person: p,
        share_amount: i === n - 1
          ? Math.round((amount - per * (n - 1)) * 100) / 100
          : per,
      }));
    }

    try {
      await updateExpense(orig.id, {
        raw_text: orig.raw_text, amount, item: editItem || '未知',
        category: editCategory || '其他', split_type: orig.split_type, splits,
        currency: orig.currency || 'CNY',
      });
      setEditModal(null);
      loadExpenses(1, true);
      Alert.alert('✅', '账单已更新');
    } catch (err) { Alert.alert('更新失败', err.message); }
  }

  function handleRefresh() { setRefreshing(true); loadExpenses(1, true); }
  function handleLoadMore() { if (page < totalPages && !loading) loadExpenses(page + 1); }

  const grouped = groupByDate(expenses);

  return (
    <View style={styles.container}>
      {/* 分类筛选 */}
      <View style={styles.filterBar}>
        <FlatList horizontal showsHorizontalScrollIndicator={false} data={categories}
          keyExtractor={item => item}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => (
            <TouchableOpacity style={[styles.filterBtn, (item === '全部' ? !filter : filter === item) && styles.filterBtnActive]}
              onPress={() => setFilter(item === '全部' ? null : item)}>
              <Text style={[styles.filterBtnText, (item === '全部' ? !filter : filter === item) && styles.filterBtnTextActive]}>{item}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* 列表 */}
      <FlatList data={Object.keys(grouped)} keyExtractor={item => item}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        onEndReached={handleLoadMore} onEndReachedThreshold={0.3}
        renderItem={({ item: date }) => (
          <View>
            <View style={styles.dateHeader}>
              <Text style={styles.dateText}>{date}</Text>
              <Text style={styles.dateAmount}>
                ¥{grouped[date].reduce((s, e) => s + (e.splits?.find(sp => sp.person === '我')?.share_amount || e.amount || 0), 0).toFixed(2)}
              </Text>
            </View>
            {grouped[date].map(expense => (
              <ExpenseCard key={expense.id} expense={expense}
                onPress={() => setDetailModal(expense)}
                onLongPress={() => handleDelete(expense.id)} />
            ))}
          </View>
        )}
        ListEmptyComponent={<View style={styles.empty}><Ionicons name="file-tray-outline" size={44} color="#9CA3AF" /><Text style={styles.emptyText}>暂无账单记录</Text></View>}
        contentContainerStyle={{ paddingBottom: 20 }}
      />

      {/* 详情弹窗 */}
      <Modal visible={!!detailModal} animationType="fade" transparent onRequestClose={() => setDetailModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>账单详情</Text>
              <TouchableOpacity onPress={() => setDetailModal(null)}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
            </View>
            {detailModal && (
              <SplitDetail splits={detailModal.splits} totalAmount={detailModal.amount} splitType={detailModal.split_type} />
            )}
            <View style={styles.detailActions}>
              <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(detailModal)}>
                <Text style={styles.editBtnText}>✏️ 编辑</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => { const id = detailModal?.id; setDetailModal(null); handleDelete(id); }}>
                <Text style={styles.deleteBtnText}>🗑 删除</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 编辑弹窗 */}
      <Modal visible={!!editModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditModal(null)}>
        <View style={styles.editContainer}>
          {/* 头部 */}
          <View style={styles.editHeader}>
            <TouchableOpacity onPress={() => setEditModal(null)} style={styles.editHeaderBtn}>
              <Ionicons name="close" size={22} color="#6B7280" />
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.editTitle}>编辑账单</Text>
              <Text style={styles.editSub}>修改金额、商品或分类</Text>
            </View>
            <TouchableOpacity onPress={handleSaveEdit} style={styles.editSaveBtn}>
              <Ionicons name="checkmark" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          {editModal && (
            <ScrollView style={styles.editBody} contentContainerStyle={{ paddingBottom: 40 }}>
              {/* 金额卡片 */}
              <View style={styles.editCard}>
                <Text style={styles.editCardLabel}>金额</Text>
                <View style={styles.amountInputRow}>
                  <Text style={styles.currencySign}>¥</Text>
                  <TextInput style={styles.amountInput} value={editAmount} onChangeText={setEditAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#D1D5DB" />
                </View>
              </View>

              {/* 商品卡片 */}
              <View style={styles.editCard}>
                <Text style={styles.editCardLabel}>商品 / 服务</Text>
                <TextInput style={styles.editCardInput} value={editItem} onChangeText={setEditItem} placeholder="例如：晚饭" placeholderTextColor="#D1D5DB" />
              </View>

              {/* 分类卡片 */}
              <View style={styles.editCard}>
                <Text style={styles.editCardLabel}>分类</Text>
                <View style={styles.catGrid}>
                  {[
                    { name: '餐饮', icon: 'fast-food', color: '#F59E0B' },
                    { name: '交通', icon: 'car', color: '#3B82F6' },
                    { name: '购物', icon: 'cart', color: '#10B981' },
                    { name: '娱乐', icon: 'game-controller', color: '#8B5CF6' },
                    { name: '居住', icon: 'home', color: '#EF4444' },
                    { name: '其他', icon: 'wallet', color: '#6B7280' },
                  ].map(cat => {
                    const active = editCategory === cat.name;
                    return (
                      <TouchableOpacity key={cat.name}
                        style={[styles.catGridItem, active && { backgroundColor: cat.color + '15', borderColor: cat.color }]}
                        onPress={() => setEditCategory(cat.name)}>
                        <Ionicons name={cat.icon} size={22} color={active ? cat.color : '#9CA3AF'} />
                        <Text style={[styles.catGridText, active && { color: cat.color, fontWeight: '700' }]}>{cat.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* 分摊预览 */}
              <SplitDetail splits={editModal.splits} totalAmount={parseFloat(editAmount) || editModal.amount} splitType={editModal.split_type} />
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

function groupByDate(expenses) {
  const g = {};
  for (const e of expenses) {
    const d = e.created_at ? new Date(e.created_at) : new Date();
    const k = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
    if (!g[k]) g[k] = [];
    g[k].push(e);
  }
  return g;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  filterBar: { backgroundColor: '#fff', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  filterList: { paddingHorizontal: 12, gap: 8 },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 16, backgroundColor: '#F3F4F6' },
  filterBtnActive: { backgroundColor: '#6366F1' },
  filterBtnText: { fontSize: 13, color: '#6B7280' },
  filterBtnTextActive: { color: '#fff', fontWeight: '600' },
  dateHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 16, marginTop: 16, marginBottom: 4 },
  dateText: { fontSize: 14, fontWeight: '700', color: '#374151' },
  dateAmount: { fontSize: 14, fontWeight: '600', color: '#6366F1' },
  empty: { alignItems: 'center', padding: 60 },
  emptyIconBox: { marginBottom: 12 },
  emptyText: { fontSize: 16, color: '#9CA3AF' },
  // 详情弹窗
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  modalClose: { fontSize: 20, color: '#9CA3AF', padding: 4 },
  detailActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  editBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#EEF2FF', alignItems: 'center' },
  editBtnText: { color: '#6366F1', fontSize: 15, fontWeight: '500' },
  deleteBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#FEF2F2', alignItems: 'center' },
  deleteBtnText: { color: '#EF4444', fontSize: 15, fontWeight: '500' },
  // 编辑弹窗
  editContainer: { flex: 1, backgroundColor: '#F1F5F9' },
  editHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  editHeaderBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  editTitle: { fontSize: 17, fontWeight: '700', color: '#1F2937' },
  editSub: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  editSaveBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#4F46E5', justifyContent: 'center', alignItems: 'center' },
  editBody: { padding: 16 },
  editCard: { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  editCardLabel: { fontSize: 13, fontWeight: '600', color: '#9CA3AF', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  amountInputRow: { flexDirection: 'row', alignItems: 'center' },
  currencySign: { fontSize: 28, fontWeight: '700', color: '#4F46E5', marginRight: 8 },
  amountInput: { flex: 1, fontSize: 28, fontWeight: '700', color: '#1F2937', padding: 0 },
  editCardInput: { fontSize: 17, color: '#1F2937', padding: 0, fontWeight: '500' },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  catGridItem: { width: '30%', aspectRatio: 1.6, borderRadius: 14, borderWidth: 2, borderColor: '#F1F5F9', backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' },
  catGridText: { fontSize: 12, fontWeight: '600', color: '#9CA3AF', marginTop: 4 },
});
