import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Modal, FlatList } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getDailyStats } from '../services/api';

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];
const CCY = [
  { code: 'CNY', sym: '¥' }, { code: 'USD', sym: '$' }, { code: 'EUR', sym: '€' },
  { code: 'GBP', sym: '£' }, { code: 'JPY', sym: '¥' }, { code: 'HKD', sym: 'HK$' }, { code: 'KRW', sym: '₩' },
];

// 金额 → 颜色强度
function amountColor(total, maxTotal) {
  if (!total || maxTotal <= 0) return { bg: '#F9FAFB', text: '#D1D5DB' };
  const ratio = Math.min(total / maxTotal, 1);
  // 从浅紫到深紫
  const r = Math.round(79 + (79 - 79));
  if (ratio < 0.2) return { bg: '#F5F3FF', text: '#7C3AED' };
  if (ratio < 0.5) return { bg: '#EDE9FE', text: '#6D28D9' };
  if (ratio < 0.8) return { bg: '#DDD6FE', text: '#5B21B6' };
  return { bg: '#C4B5FD', text: '#4C1D95' };
}

export default function StatsScreen() {
  const [daily, setDaily] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [ccyModal, setCcyModal] = useState(false);
  const [currencyCode, setCurrencyCode] = useState('CNY');
  const [refreshing, setRefreshing] = useState(false);
  const ccy = CCY.find(c => c.code === currencyCode) || CCY[0];
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  useFocusEffect(useCallback(() => { loadStats(); }, [year, month, currencyCode]));

  async function loadStats() {
    try {
      const data = await getDailyStats(year, month, currencyCode);
      setDaily(data); setSelectedDay(null);
    } catch (_) { } finally { setRefreshing(false); }
  }

  function prevMonth() { setMonth(m => m === 1 ? 12 : m - 1); if (month === 1) setYear(y => y - 1); }
  function nextMonth() { setMonth(m => m === 12 ? 1 : m + 1); if (month === 12) setYear(y => y + 1); }

  // 构建日历网格
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1; // 周一=0

  const maxTotal = daily ? Math.max(...daily.daily.map(d => d.total), 1) : 1;
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // 选中日的详情
  const selData = selectedDay ? daily?.daily?.find(d => d.day === selectedDay) : null;

  return (
    <>
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadStats(); }} />}>
      {/* 月份导航 */}
      <View style={styles.monthBar}>
        <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={22} color="#4F46E5" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.ccyBtn} onPress={() => setCcyModal(true)}>
          <Ionicons name="cash-outline" size={16} color="#4F46E5" />
          <Text style={styles.ccyText}> {ccy.sym} {ccy.code}</Text>
          <Ionicons name="chevron-down" size={14} color="#4F46E5" />
        </TouchableOpacity>
        <Text style={styles.monthTitle}>{year}年 {month}月</Text>
        <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={22} color="#4F46E5" />
        </TouchableOpacity>
      </View>

      {/* 月总计条 */}
      <View style={styles.totalBar}>
        <View style={styles.totalItem}>
          <Text style={styles.totalLabel}>月支出</Text>
          <Text style={styles.totalValue}>{ccy.sym}{daily?.monthTotal?.toFixed(2) || '0.00'}</Text>
        </View>
        <View style={styles.totalDivider} />
        <View style={styles.totalItem}>
          <Text style={styles.totalLabel}>日均</Text>
          <Text style={styles.totalValue}>{ccy.sym}{daily ? (daily.monthTotal / daysInMonth).toFixed(2) : '0.00'}</Text>
        </View>
        <View style={styles.totalDivider} />
        <View style={styles.totalItem}>
          <Text style={styles.totalLabel}>笔数</Text>
          <Text style={styles.totalValue}>{daily?.daily?.reduce((s, d) => s + d.count, 0) || 0}</Text>
        </View>
      </View>

      {/* 星期头 */}
      <View style={styles.weekHeader}>
        {WEEKDAYS.map(d => (
          <View key={d} style={styles.weekCell}><Text style={styles.weekText}>{d}</Text></View>
        ))}
      </View>

      {/* 日历网格 */}
      <View style={styles.calendar}>
        {/* 空白填充 */}
        {Array.from({ length: startOffset }).map((_, i) => (
          <View key={`pad-${i}`} style={styles.dayCell} />
        ))}
        {/* 日期 */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const d = i + 1;
          const key = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const data = daily?.daily?.[i];
          const total = data?.total || 0;
          const isToday = key === todayKey;
          const isSelected = key === selectedDay;
          const { bg, text } = amountColor(total, maxTotal);

          return (
            <TouchableOpacity key={d} style={[styles.dayCell, { backgroundColor: isSelected ? '#4F46E5' : bg }]}
              onPress={() => setSelectedDay(isSelected ? null : key)}>
              <Text style={[styles.dayNum, { color: isSelected ? '#fff' : isToday ? '#4F46E5' : '#374151', fontWeight: isToday || isSelected ? '700' : '400' }]}>
                {d}
              </Text>
              {total > 0 && (
                <Text style={[styles.dayAmount, { color: isSelected ? 'rgba(255,255,255,0.8)' : text }]}
                  numberOfLines={1}>
                  {ccy.sym}{total.toFixed(0)}
                </Text>
              )}
              {isToday && !isSelected && <View style={styles.todayDot} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 选中日的详情 */}
      {selData && selData.total > 0 && (
        <View style={styles.dayDetail}>
          <View style={styles.dayDetailHeader}>
            <Ionicons name="calendar" size={18} color="#4F46E5" />
            <Text style={styles.dayDetailTitle}> {selectedDay}</Text>
          </View>
          <View style={styles.dayDetailRow}>
            <Text style={styles.dayDetailLabel}>当日支出</Text>
            <Text style={styles.dayDetailAmount}>{ccy.sym}{selData.total.toFixed(2)}</Text>
          </View>
          <View style={styles.dayDetailRow}>
            <Text style={styles.dayDetailLabel}>笔数</Text>
            <Text style={styles.dayDetailCount}>{selData.count} 笔</Text>
          </View>
        </View>
      )}

      {/* 图例 */}
      <View style={styles.legend}>
        <Text style={styles.legendText}>颜色越深 支出越多</Text>
        <View style={styles.legendColors}>
          {['#F9FAFB', '#F5F3FF', '#EDE9FE', '#DDD6FE', '#C4B5FD'].map((c, i) => (
            <View key={i} style={[styles.legendDot, { backgroundColor: c }]} />
          ))}
        </View>
      </View>

      <View style={{ height: 30 }} />
    </ScrollView>

    {/* 币种选择弹窗 */}
    <Modal visible={ccyModal} animationType="fade" transparent onRequestClose={() => setCcyModal(false)}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' }} activeOpacity={1} onPress={() => setCcyModal(false)}>
        <View style={styles.ccyModal}>
          <Text style={styles.ccyModalTitle}>选择显示货币</Text>
          {CCY.map(c => (
            <TouchableOpacity key={c.code} style={[styles.ccyItem, c.code === currencyCode && styles.ccyItemActive]}
              onPress={() => { setCurrencyCode(c.code); setCcyModal(false); }}>
              <Text style={styles.ccyItemSym}>{c.sym}</Text>
              <Text style={[styles.ccyItemCode, c.code === currencyCode && { color: '#4F46E5', fontWeight: '700' }]}>{c.code}</Text>
              {c.code === currencyCode && <Ionicons name="checkmark" size={20} color="#4F46E5" />}
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.ccyCancel} onPress={() => setCcyModal(false)}>
            <Text style={styles.ccyCancelText}>取消</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  // 月份
  monthBar: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 14 },
  navBtn: { padding: 8, backgroundColor: '#fff', borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  ccyBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#EEF2FF', borderRadius: 12, gap: 4 },
  ccyText: { fontSize: 13, fontWeight: '600', color: '#4F46E5' },
  monthTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937', marginHorizontal: 20, minWidth: 100, textAlign: 'center' },
  // 总计
  totalBar: { flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 16, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  totalItem: { flex: 1, alignItems: 'center' },
  totalLabel: { fontSize: 12, color: '#9CA3AF', marginBottom: 4 },
  totalValue: { fontSize: 17, fontWeight: '700', color: '#1F2937' },
  totalDivider: { width: 1, height: 30, backgroundColor: '#F1F5F9' },
  // 星期头
  weekHeader: { flexDirection: 'row', marginHorizontal: 16, marginTop: 16 },
  weekCell: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  weekText: { fontSize: 12, fontWeight: '600', color: '#9CA3AF' },
  // 日历
  calendar: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', padding: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  dayCell: {
    width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center',
    borderRadius: 10, padding: 2,
  },
  dayNum: { fontSize: 14, marginBottom: 1 },
  dayAmount: { fontSize: 10, fontWeight: '600' },
  todayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#4F46E5', marginTop: 1 },
  // 日详情
  dayDetail: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  dayDetailHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  dayDetailTitle: { fontSize: 15, fontWeight: '600', color: '#374151' },
  dayDetailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  dayDetailLabel: { fontSize: 14, color: '#6B7280' },
  dayDetailAmount: { fontSize: 16, fontWeight: '700', color: '#4F46E5' },
  dayDetailCount: { fontSize: 14, fontWeight: '600', color: '#374151' },
  // 图例
  legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16, gap: 8 },
  legendText: { fontSize: 11, color: '#9CA3AF' },
  legendColors: { flexDirection: 'row', gap: 4 },
  legendDot: { width: 16, height: 16, borderRadius: 4, borderWidth: 1, borderColor: '#E5E7EB' },
  // 币种弹窗
  ccyModal: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  ccyModalTitle: { fontSize: 17, fontWeight: '700', color: '#1F2937', textAlign: 'center', marginBottom: 16 },
  ccyItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, marginBottom: 4 },
  ccyItemActive: { backgroundColor: '#EEF2FF' },
  ccyItemSym: { fontSize: 20, width: 36, textAlign: 'center', marginRight: 12 },
  ccyItemCode: { fontSize: 16, color: '#374151', flex: 1 },
  ccyCancel: { marginTop: 8, paddingVertical: 14, alignItems: 'center' },
  ccyCancelText: { fontSize: 16, color: '#9CA3AF' },
});
