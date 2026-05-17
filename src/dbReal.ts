import { createClient } from '@supabase/supabase-js';

export type Cliente = { id: string; nome: string; telefone: string; rua?: string; numero?: string; bairro?: string; cidade?: string; estado?: string; cep?: string; observacoes?: string };
export type Produto = { id: string; nome: string; unidade: string; preco: number; ativo: boolean };
export type Admin = { id: string; nome: string; telefone: string; pin: string; papel: string };
export type Pedido = { id: string; codigo: string; cliente_id: string | null; cliente_nome: string; telefone: string; produto_id: string | null; produto_nome: string; quantidade: number; preco_unitario: number; total: number; tipo_entrega: string; endereco: string; forma_pagamento: string; status_pagamento: string; status_pedido: string; observacoes: string; data_pedido: string; data_entrega: string };

export const ADMIN_PRINCIPAL = '18997232533';
const url = import.meta.env.VITE_SUPABASE_URL || 'https://ywwztahbqgiwervbwudg.supabase.co';
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_er0Z1O0s1opKniqu3cYkGg_svVBvXRx';
export const supabase = createClient(url, key);

export const nums = (v: string) => String(v || '').replace(/\D/g, '');
export const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
export const money = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const today = () => new Date().toISOString().slice(0, 10);
export const nextFriday = () => { const d = new Date(); d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7)); return d.toISOString().slice(0, 10); };
export const address = (c?: Cliente) => c ? [c.rua, c.numero, c.bairro, c.cidade, c.estado].filter(Boolean).join(', ') : '';

export async function loadAll() {
  const [a, c, p, o] = await Promise.all([
    supabase.from('qlp_admins').select('*').order('nome'),
    supabase.from('qlp_clientes').select('*').order('created_at', { ascending: false }),
    supabase.from('qlp_produtos').select('*').order('nome'),
    supabase.from('qlp_pedidos').select('*').order('created_at', { ascending: false }),
  ]);
  if (a.error) throw a.error;
  if (c.error) throw c.error;
  if (p.error) throw p.error;
  if (o.error) throw o.error;
  return {
    admins: (a.data || []) as Admin[],
    clientes: (c.data || []) as Cliente[],
    produtos: (p.data || []).map((x: any) => ({ ...x, preco: Number(x.preco || 0) })) as Produto[],
    pedidos: (o.data || []).map((x: any) => ({ ...x, quantidade: Number(x.quantidade || 0), preco_unitario: Number(x.preco_unitario || 0), total: Number(x.total || 0) })) as Pedido[],
  };
}

export async function insertRow(table: string, row: any) {
  const { error } = await supabase.from(table).insert(row);
  if (error) throw error;
}
export async function updateRow(table: string, id: string, row: any) {
  const { error } = await supabase.from(table).update(row).eq('id', id);
  if (error) throw error;
}
export async function deleteRow(table: string, id: string) {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
}
