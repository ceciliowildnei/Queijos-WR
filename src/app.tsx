import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { ADMIN_PRINCIPAL, Admin, Cliente, Pedido, Produto, address, deleteRow, insertRow, loadAll, money, nextFriday, nums, today, uid, updateRow } from './dbReal';

type Usuario = { nome: string; telefone: string; papel: string } | null;

function Marca() {
  return <div className="marca"><b>Queijos WR</b><small>Sabor e tradição</small></div>;
}

function App() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [usuario, setUsuario] = useState<Usuario>(() => JSON.parse(localStorage.getItem('qlp_usuario') || 'null'));
  const [tela, setTela] = useState('dash');
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  async function carregar() {
    try {
      const dados = await loadAll();
      setClientes(dados.clientes);
      setProdutos(dados.produtos);
      setPedidos(dados.pedidos);
      setAdmins(dados.admins);
      setErro('');
    } catch (e: any) {
      setErro(e?.message || 'Erro ao acessar o banco online.');
    } finally {
      setLoading(false);
    }
  }

  async function inserir(tabela: string, linha: any) {
    try { await insertRow(tabela, linha); await carregar(); }
    catch (e: any) { alert('Erro ao salvar: ' + (e?.message || 'erro desconhecido')); }
  }
  async function atualizar(tabela: string, id: string, linha: any) {
    try { await updateRow(tabela, id, linha); await carregar(); }
    catch (e: any) { alert('Erro ao atualizar: ' + (e?.message || 'erro desconhecido')); }
  }
  async function excluir(tabela: string, id: string) {
    try { await deleteRow(tabela, id); await carregar(); }
    catch (e: any) { alert('Erro ao excluir: ' + (e?.message || 'erro desconhecido')); }
  }

  useEffect(() => {
    carregar();
    const id = setInterval(carregar, 8000);
    return () => clearInterval(id);
  }, []);

  const pedidosSexta = pedidos.filter(p => p.data_entrega === nextFriday());
  const resumo = useMemo(() => ({
    pedidos: pedidosSexta.length,
    receita: pedidosSexta.reduce((s, p) => s + p.total, 0),
    q1: pedidosSexta.filter(p => p.produto_nome === 'Queijo 1kg').reduce((s, p) => s + p.quantidade, 0),
    q500: pedidosSexta.filter(p => p.produto_nome === 'Queijo 500g').reduce((s, p) => s + p.quantidade, 0),
    leite: pedidosSexta.filter(p => p.produto_nome === 'Leite').reduce((s, p) => s + p.quantidade, 0),
  }), [pedidos]);

  if (loading) return <div className="center"><div>Carregando banco online...</div></div>;
  if (erro) return <div className="center"><div><b>Erro no banco</b><p>{erro}</p><button onClick={carregar}>Tentar novamente</button></div></div>;
  if (!usuario) return <Login admins={admins} onLogin={(u: Usuario) => { localStorage.setItem('qlp_usuario', JSON.stringify(u)); setUsuario(u); }} />;

  const menu: any = { dash: 'Dashboard', clientes: 'Clientes', novo: 'Novo pedido', pedidos: 'Pedidos', produtos: 'Produtos', sexta: 'Pedidos da sexta', admins: 'Administradores' };
  return <>
    <aside className="menu">{Object.keys(menu).map(k => <button key={k} className={tela === k ? 'active' : ''} onClick={() => setTela(k)}>{menu[k]}</button>)}</aside>
    <header className="hero"><Marca/><div><h1>Queijos WR Pedidos</h1><p>Sistema online com tabelas reais no Supabase</p></div><button onClick={() => { localStorage.removeItem('qlp_usuario'); setUsuario(null); }}>Sair</button></header>
    <main className="container">
      {tela === 'dash' && <Dashboard r={resumo}/>} {tela === 'clientes' && <Clientes clientes={clientes} inserir={inserir}/>} {tela === 'novo' && <Novo clientes={clientes} produtos={produtos} pedidos={pedidos} inserir={inserir}/>} {tela === 'pedidos' && <Pedidos pedidos={pedidos} atualizar={atualizar} excluir={excluir}/>} {tela === 'sexta' && <Pedidos pedidos={pedidosSexta} atualizar={atualizar} excluir={excluir}/>} {tela === 'produtos' && <Produtos produtos={produtos} atualizar={atualizar}/>} {tela === 'admins' && <Admins admins={admins} inserir={inserir}/>} 
    </main>
  </>;
}

function Login({ admins, onLogin }: any) {
  const [tel, setTel] = useState(ADMIN_PRINCIPAL), [pin, setPin] = useState('');
  function entrar() { const a = admins.find((x: Admin) => nums(x.telefone) === nums(tel)); if (!a) return alert('Telefone não autorizado'); if (a.pin !== pin) return alert('PIN incorreto'); onLogin({ nome: a.nome, telefone: a.telefone, papel: a.papel }); }
  return <main className="login"><section><Marca/><h1>Entrar</h1><input value={tel} onChange={e => setTel(e.target.value)} placeholder="Celular com DDD"/><input value={pin} onChange={e => setPin(nums(e.target.value))} placeholder="PIN" type="password"/><button onClick={entrar}>Entrar</button><small>PIN inicial: 1234</small></section></main>;
}
function Dashboard({ r }: any) { return <section><h2>Dashboard</h2><div className="cards">{[['Pedidos da sexta', r.pedidos], ['Receita', money(r.receita)], ['Queijo 1kg', r.q1], ['Queijo 500g', r.q500], ['Leite', r.leite]].map(([a,b]) => <div className="card" key={String(a)}><span>{a}</span><b>{b}</b></div>)}</div></section>; }
function Clientes({ clientes, inserir }: any) { const [f, setF] = useState<any>({}); return <Panel title="Clientes"><div className="grid">{['nome','telefone','rua','numero','bairro','cidade','estado'].map(k => <input key={k} placeholder={k} value={f[k] || ''} onChange={e => setF({...f,[k]:e.target.value})}/>)}</div><button onClick={() => { if (!f.nome) return alert('Informe o nome'); inserir('qlp_clientes', {...f, id: uid(), telefone: nums(f.telefone)}); setF({}); }}>Cadastrar cliente</button><List>{clientes.map((c: Cliente) => <div className="row" key={c.id}><b>{c.nome}</b><span>{c.telefone}</span><span>{address(c)}</span></div>)}</List></Panel>; }
function Novo({ clientes, produtos, pedidos, inserir }: any) { const [f,setF]=useState<any>({cliente_id:'',produto_id:'',quantidade:1,endereco:'',data_entrega:nextFriday()}); const c=clientes.find((x:Cliente)=>x.id===f.cliente_id), p=produtos.find((x:Produto)=>x.id===f.produto_id), total=(p?.preco||0)*Number(f.quantidade||0); function add(){ if(!c||!p) return alert('Selecione cliente e produto'); inserir('qlp_pedidos',{id:uid(),codigo:'PED-'+String(pedidos.length+1).padStart(4,'0'),cliente_id:c.id,cliente_nome:c.nome,telefone:c.telefone,produto_id:p.id,produto_nome:p.nome,quantidade:Number(f.quantidade),preco_unitario:p.preco,total,tipo_entrega:'Retirada',endereco:f.endereco||address(c),forma_pagamento:'Pix',status_pagamento:'Pendente',status_pedido:'Pendente',observacoes:'',data_pedido:today(),data_entrega:f.data_entrega}); alert('Pedido salvo no banco online'); } return <Panel title="Novo pedido"><div className="grid"><select value={f.cliente_id} onChange={e=>{const cli=clientes.find((x:Cliente)=>x.id===e.target.value);setF({...f,cliente_id:e.target.value,endereco:address(cli)})}}><option value="">Cliente</option>{clientes.map((c:Cliente)=><option key={c.id} value={c.id}>{c.nome}</option>)}</select><select value={f.produto_id} onChange={e=>setF({...f,produto_id:e.target.value})}><option value="">Produto</option>{produtos.filter((p:Produto)=>p.ativo).map((p:Produto)=><option key={p.id} value={p.id}>{p.nome} {money(p.preco)}</option>)}</select><input type="number" value={f.quantidade} onChange={e=>setF({...f,quantidade:e.target.value})}/><input value={f.endereco} onChange={e=>setF({...f,endereco:e.target.value})} placeholder="Endereço"/><input type="date" value={f.data_entrega} onChange={e=>setF({...f,data_entrega:e.target.value})}/></div><div className="total">Total: {money(total)}</div><button onClick={add}>Salvar pedido</button></Panel>; }
function Pedidos({ pedidos, atualizar, excluir }: any) { return <Panel title="Pedidos"><List>{pedidos.map((p: Pedido) => <div className="pedido" key={p.id}><div><b>{p.codigo}</b><h3>{p.cliente_nome}</h3><p>{p.produto_nome} - {p.quantidade} - {money(p.total)}</p><p>{p.endereco}</p></div><div><select value={p.status_pedido} onChange={e => atualizar('qlp_pedidos', p.id, {status_pedido:e.target.value})}><option>Pendente</option><option>Recebido</option><option>Separado</option><option>Saiu para entrega</option><option>Entregue</option><option>Cancelado</option></select><select value={p.status_pagamento} onChange={e => atualizar('qlp_pedidos', p.id, {status_pagamento:e.target.value})}><option>Pendente</option><option>Pago</option><option>Parcial</option></select><button className="danger" onClick={() => excluir('qlp_pedidos', p.id)}>Excluir</button></div></div>)}</List></Panel>; }
function Produtos({ produtos, atualizar }: any) { return <Panel title="Produtos"><List>{produtos.map((p: Produto) => <div className="row" key={p.id}><b>{p.nome}</b><input type="number" value={p.preco} onChange={e => atualizar('qlp_produtos', p.id, {preco:Number(e.target.value)})}/><label><input type="checkbox" checked={p.ativo} onChange={e => atualizar('qlp_produtos', p.id, {ativo:e.target.checked})}/> Ativo</label></div>)}</List></Panel>; }
function Admins({ admins, inserir }: any) { const [f,setF]=useState({nome:'',telefone:'',pin:''}); return <Panel title="Administradores"><div className="grid"><input placeholder="Nome" value={f.nome} onChange={e=>setF({...f,nome:e.target.value})}/><input placeholder="Celular" value={f.telefone} onChange={e=>setF({...f,telefone:e.target.value})}/><input placeholder="PIN" value={f.pin} onChange={e=>setF({...f,pin:nums(e.target.value)})}/></div><button onClick={()=>{ if(!f.nome||!f.telefone||f.pin.length<4) return alert('Preencha nome, telefone e PIN'); inserir('qlp_admins',{id:uid(),nome:f.nome,telefone:nums(f.telefone),pin:f.pin,papel:'Administrador'}); setF({nome:'',telefone:'',pin:''}); }}>Adicionar</button><List>{admins.map((a:Admin)=><div className="row" key={a.id}><b>{a.nome}</b><span>{a.telefone}</span><span>{a.papel}</span></div>)}</List></Panel>; }
function Panel(p:any){return <section className="panel"><h2>{p.title}</h2>{p.children}</section>} function List(p:any){return <div className="list">{p.children}</div>}
createRoot(document.getElementById('root')!).render(<App/>);
