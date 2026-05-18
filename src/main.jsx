import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import './style.css';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ywwztahbqgiwervbwudg.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJIUzI1NiIsInJlZiI6Inl3d3p0YWhicWdpd2VydmJ3dWRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMjU1ODMsImV4cCI6MjA5NDYwMTU4M30.kzOjAWiu19zH4IzgBxGAVm31beNNilbYsVs97aGB2Zo';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const dinheiro = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const hojeISO = () => new Date().toISOString().slice(0, 10);
const proxSexta = () => {
  const d = new Date();
  const day = d.getDay();
  let diff = (5 - day + 7) % 7;
  if (diff === 0) diff = 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
};
const tel = (v) => String(v || '').replace(/\D/g, '');

function App() {
  const [admin, setAdmin] = useState(null);
  const [login, setLogin] = useState({ telefone: '', pin: '' });
  const [erro, setErro] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [aba, setAba] = useState('dashboard');
  const lastCount = useRef(0);

  const [clienteForm, setClienteForm] = useState({ nome: '', telefone: '', cep: '', rua: '', numero: '', bairro: '', cidade: '', estado: '', complemento: '', observacoes: '' });
  const [produtoForm, setProdutoForm] = useState({ nome: '', unidade: 'unidade', preco: '' });
  const [pedidoForm, setPedidoForm] = useState({ cliente_id: '', produto_id: '', quantidade: 1, tipo_entrega: 'Retirada', forma_pagamento: 'Pix', status_pagamento: 'Pendente', status_pedido: 'Pendente', data_entrega: proxSexta(), observacoes: '' });

  async function entrar(e) {
    e.preventDefault();
    setErro('');
    setLoading(true);
    const { data, error } = await supabase.from('wr_admins').select('*').eq('telefone', tel(login.telefone)).eq('pin', login.pin).eq('ativo', true).maybeSingle();
    setLoading(false);
    if (error || !data) return setErro('Celular ou PIN inválido. Confira os dados e tente novamente.');
    setAdmin(data);
  }

  async function carregar(silencioso = false) {
    if (!silencioso) setLoading(true);
    setErro('');
    const [c, p, o] = await Promise.all([
      supabase.from('wr_clientes').select('*').order('criado_em', { ascending: false }),
      supabase.from('wr_produtos').select('*').order('nome'),
      supabase.from('wr_pedidos').select('*').order('criado_em', { ascending: false })
    ]);
    if (c.error || p.error || o.error) setErro('Não foi possível sincronizar com o Supabase.');
    else {
      setClientes(c.data || []); setProdutos(p.data || []); setPedidos(o.data || []);
      if (lastCount.current && (o.data || []).length > lastCount.current) beep();
      lastCount.current = (o.data || []).length;
      if (!silencioso) setMsg('Dados sincronizados com o Supabase.');
    }
    if (!silencioso) setLoading(false);
  }

  useEffect(() => {
    if (!admin) return;
    carregar(true);
    const channel = supabase.channel('wr-pedidos-tempo-real')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wr_pedidos' }, () => carregar(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wr_clientes' }, () => carregar(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wr_produtos' }, () => carregar(true))
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [admin]);

  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination); osc.frequency.value = 880; gain.gain.value = 0.04; osc.start(); osc.stop(ctx.currentTime + 0.18);
    } catch {}
  }

  async function salvarCliente(e) {
    e.preventDefault(); setLoading(true);
    const { error } = await supabase.from('wr_clientes').insert([{ ...clienteForm, telefone: tel(clienteForm.telefone) }]);
    setLoading(false); if (error) return setErro(error.message);
    setClienteForm({ nome: '', telefone: '', cep: '', rua: '', numero: '', bairro: '', cidade: '', estado: '', complemento: '', observacoes: '' });
    setMsg('Cliente cadastrado no Supabase.'); carregar(true);
  }

  async function salvarProduto(e) {
    e.preventDefault(); setLoading(true);
    const { error } = await supabase.from('wr_produtos').insert([{ nome: produtoForm.nome, unidade: produtoForm.unidade, preco: Number(produtoForm.preco || 0), ativo: true }]);
    setLoading(false); if (error) return setErro(error.message);
    setProdutoForm({ nome: '', unidade: 'unidade', preco: '' }); setMsg('Produto cadastrado no Supabase.'); carregar(true);
  }

  async function salvarPedido(e) {
    e.preventDefault(); setLoading(true);
    const cliente = clientes.find(x => x.id === pedidoForm.cliente_id);
    const produto = produtos.find(x => x.id === pedidoForm.produto_id);
    if (!cliente || !produto) { setLoading(false); return setErro('Selecione cliente e produto.'); }
    const qtd = Number(pedidoForm.quantidade || 1);
    const preco = Number(produto.preco || 0);
    const endereco = [cliente.rua, cliente.numero, cliente.bairro, cliente.cidade, cliente.estado].filter(Boolean).join(', ');
    const { error } = await supabase.from('wr_pedidos').insert([{ ...pedidoForm, cliente_nome: cliente.nome, cliente_telefone: cliente.telefone, produto_nome: produto.nome, quantidade: qtd, preco_unitario: preco, total: qtd * preco, endereco }]);
    setLoading(false); if (error) return setErro(error.message);
    setPedidoForm({ cliente_id: '', produto_id: '', quantidade: 1, tipo_entrega: 'Retirada', forma_pagamento: 'Pix', status_pagamento: 'Pendente', status_pedido: 'Pendente', data_entrega: proxSexta(), observacoes: '' });
    setMsg('Pedido criado no Supabase.'); beep(); carregar(true); setAba('pedidos');
  }

  async function atualizarPedido(id, campo, valor) {
    const { error } = await supabase.from('wr_pedidos').update({ [campo]: valor }).eq('id', id);
    if (error) setErro(error.message); else carregar(true);
  }

  const resumo = useMemo(() => {
    const total = pedidos.reduce((s, p) => s + Number(p.total || 0), 0);
    const pendentes = pedidos.filter(p => p.status_pedido !== 'Entregue').length;
    const prox = proxSexta();
    return { total, pendentes, sexta: pedidos.filter(p => p.data_entrega === prox) };
  }, [pedidos]);

  if (!admin) return <Login login={login} setLogin={setLogin} entrar={entrar} erro={erro} loading={loading} />;

  return <div className="app">
    <header className="topo">
      <div className="brand"><div className="logo">Queijos <b>WR</b></div><span>Pedidos artesanais</span></div>
      <div className="top-actions"><button onClick={() => carregar()} disabled={loading}>Atualizar / sincronizar</button><button onClick={() => setAdmin(null)}>Sair</button></div>
    </header>
    <nav className="tabs">{['dashboard','clientes','produtos','novo pedido','pedidos','sexta'].map(x => <button key={x} className={aba===x?'on':''} onClick={() => setAba(x)}>{x}</button>)}</nav>
    {(erro || msg) && <div className={erro ? 'alert erro' : 'alert'}>{erro || msg}</div>}
    {aba === 'dashboard' && <section className="grid cards"><Card t="Pedidos" v={pedidos.length}/><Card t="A receber" v={dinheiro(resumo.total)}/><Card t="Pendentes" v={resumo.pendentes}/><Card t="Próxima sexta" v={resumo.sexta.length}/></section>}
    {aba === 'clientes' && <Clientes form={clienteForm} setForm={setClienteForm} salvar={salvarCliente} clientes={clientes}/>} 
    {aba === 'produtos' && <Produtos form={produtoForm} setForm={setProdutoForm} salvar={salvarProduto} produtos={produtos}/>} 
    {aba === 'novo pedido' && <NovoPedido form={pedidoForm} setForm={setPedidoForm} salvar={salvarPedido} clientes={clientes} produtos={produtos}/>} 
    {aba === 'pedidos' && <ListaPedidos pedidos={pedidos} atualizar={atualizarPedido}/>} 
    {aba === 'sexta' && <ListaPedidos pedidos={resumo.sexta} atualizar={atualizarPedido} titulo={'Pedidos da próxima sexta-feira: ' + proxSexta()}/>} 
  </div>;
}

function Login({ login, setLogin, entrar, erro, loading }) { return <main className="login"><section className="login-card"><div className="marca">Queijos <b>WR</b></div><h1>Queijos WR Pedidos</h1><p>Sistema online para pedidos de queijo e leite.</p><form onSubmit={entrar}><input placeholder="Celular" value={login.telefone} onChange={e=>setLogin({...login, telefone:e.target.value})}/><input placeholder="PIN" type="password" value={login.pin} onChange={e=>setLogin({...login, pin:e.target.value})}/><button disabled={loading}>{loading?'Entrando...':'Entrar'}</button>{erro && <div className="alert erro">{erro}</div>}</form></section></main> }
function Card({t,v}) { return <article className="card"><span>{t}</span><strong>{v}</strong></article> }
function Clientes({form,setForm,salvar,clientes}) { return <section className="grid"><form className="panel" onSubmit={salvar}><h2>Cadastrar cliente</h2>{['nome','telefone','cep','rua','numero','bairro','cidade','estado','complemento','observacoes'].map(k=><input key={k} required={k==='nome'} placeholder={k} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})}/>)}<button>Salvar cliente</button></form><div className="panel"><h2>Clientes</h2>{clientes.map(c=><p className="linha" key={c.id}><b>{c.nome}</b><br/>{c.telefone || 'sem telefone'} - {[c.rua,c.numero,c.bairro].filter(Boolean).join(', ')}</p>)}</div></section> }
function Produtos({form,setForm,salvar,produtos}) { return <section className="grid"><form className="panel" onSubmit={salvar}><h2>Cadastrar produto</h2><input required placeholder="nome" value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})}/><input placeholder="unidade" value={form.unidade} onChange={e=>setForm({...form,unidade:e.target.value})}/><input placeholder="preço" type="number" step="0.01" value={form.preco} onChange={e=>setForm({...form,preco:e.target.value})}/><button>Salvar produto</button></form><div className="panel"><h2>Produtos</h2>{produtos.map(p=><p className="linha" key={p.id}><b>{p.nome}</b><br/>{p.unidade} - {dinheiro(p.preco)}</p>)}</div></section> }
function NovoPedido({form,setForm,salvar,clientes,produtos}) { return <form className="panel wide" onSubmit={salvar}><h2>Lançar pedido</h2><select required value={form.cliente_id} onChange={e=>setForm({...form,cliente_id:e.target.value})}><option value="">Cliente</option>{clientes.map(c=><option value={c.id} key={c.id}>{c.nome}</option>)}</select><select required value={form.produto_id} onChange={e=>setForm({...form,produto_id:e.target.value})}><option value="">Produto</option>{produtos.filter(p=>p.ativo).map(p=><option value={p.id} key={p.id}>{p.nome} - {dinheiro(p.preco)}</option>)}</select><input type="number" step="0.01" min="0.01" value={form.quantidade} onChange={e=>setForm({...form,quantidade:e.target.value})}/><select value={form.tipo_entrega} onChange={e=>setForm({...form,tipo_entrega:e.target.value})}><option>Retirada</option><option>Entrega</option></select><select value={form.forma_pagamento} onChange={e=>setForm({...form,forma_pagamento:e.target.value})}><option>Pix</option><option>Dinheiro</option><option>Cartão</option><option>A combinar</option></select><select value={form.status_pagamento} onChange={e=>setForm({...form,status_pagamento:e.target.value})}><option>Pendente</option><option>Pago</option></select><select value={form.status_pedido} onChange={e=>setForm({...form,status_pedido:e.target.value})}><option>Pendente</option><option>Separado</option><option>Entregue</option><option>Cancelado</option></select><input type="date" value={form.data_entrega} onChange={e=>setForm({...form,data_entrega:e.target.value})}/><textarea placeholder="observações" value={form.observacoes} onChange={e=>setForm({...form,observacoes:e.target.value})}/><button>Criar pedido</button></form> }
function ListaPedidos({pedidos, atualizar, titulo='Lista de pedidos'}) { return <section className="panel wide"><h2>{titulo}</h2>{pedidos.length===0 && <p>Nenhum pedido encontrado.</p>}{pedidos.map(p=><article className="pedido" key={p.id}><div><b>{p.codigo}</b> - {p.cliente_nome}<br/><span>{p.produto_nome} x {p.quantidade} = {dinheiro(p.total)} | entrega: {p.data_entrega || '-'}</span><br/><small>{p.tipo_entrega} | {p.forma_pagamento} | {p.endereco}</small></div><div className="status"><select value={p.status_pedido} onChange={e=>atualizar(p.id,'status_pedido',e.target.value)}><option>Pendente</option><option>Separado</option><option>Entregue</option><option>Cancelado</option></select><select value={p.status_pagamento} onChange={e=>atualizar(p.id,'status_pagamento',e.target.value)}><option>Pendente</option><option>Pago</option></select></div></article>)}</section> }

createRoot(document.getElementById('root')).render(<App />);
