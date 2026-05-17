import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import './styles.css';

type Cliente = { id: string; nome: string; telefone: string; cep?: string; rua?: string; numero?: string; bairro?: string; cidade?: string; estado?: string; complemento?: string; observacoes?: string };
type Produto = { id: string; nome: string; unidade: string; preco: number; ativo: boolean };
type Admin = { id: string; nome: string; telefone: string; pin: string; papel: 'Administrador' };
type Pedido = { id: string; codigo: string; clienteId: string; clienteNome: string; telefone: string; produtoId: string; produtoNome: string; quantidade: number; precoUnitario: number; total: number; tipoEntrega: 'Retirada' | 'Entrega'; endereco: string; formaPagamento: string; statusPagamento: string; statusPedido: string; observacoes: string; dataPedido: string; dataEntrega: string };
type Usuario = { nome: string; telefone: string; papel: 'Administrador' } | null;
type Store = { clientes: Cliente[]; produtos: Produto[]; pedidos: Pedido[]; admins: Admin[]; whatsappNegocio: string };

const APP_ID = 'queijos-wr-pedidos';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ywwztahbqgiwervbwudg.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_er0Z1O0s1opKniqu3cYkGg_svVBvXRx';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const ADMIN_PRINCIPAL = '18997232533';
const soNumeros = (v: string) => String(v || '').replace(/\D/g, '');
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const hojeIso = () => new Date().toISOString().slice(0, 10);
const moeda = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const sexta = (offset = 0) => { const d = new Date(); const dia = d.getDay(); d.setDate(d.getDate() + ((5 - dia + 7) % 7) + offset * 7); return d.toISOString().slice(0, 10); };
const enderecoCliente = (c?: Cliente) => c ? [c.rua, c.numero, c.bairro, c.cidade, c.estado].filter(Boolean).join(', ') : '';

const initial: Store = {
  clientes: [],
  pedidos: [],
  produtos: [
    { id: 'queijo-1kg', nome: 'Queijo 1kg', unidade: 'kg', preco: 35, ativo: true },
    { id: 'queijo-500g', nome: 'Queijo 500g', unidade: '500g', preco: 18, ativo: true },
    { id: 'leite', nome: 'Leite', unidade: 'litro', preco: 0, ativo: true },
  ],
  admins: [
    { id: 'admin-wildnei', nome: 'Wildnei', telefone: ADMIN_PRINCIPAL, pin: '1234', papel: 'Administrador' },
    { id: 'admin-wildnei-2', nome: 'Wildnei', telefone: '18997670950', pin: '1234', papel: 'Administrador' },
  ],
  whatsappNegocio: '5518997232533',
};

async function readKey<T>(key: string, fallback: T): Promise<T> {
  const { data, error } = await supabase.from('app_state').select('value').eq('app_id', APP_ID).eq('key', key).maybeSingle();
  if (error) throw error;
  return (data?.value ?? fallback) as T;
}

async function writeKey(key: string, value: unknown) {
  const { error } = await supabase.from('app_state').upsert({ app_id: APP_ID, key, value, updated_at: new Date().toISOString() });
  if (error) throw error;
}

async function ensureStore(): Promise<Store> {
  await writeKey('qlp_produtos', await readKey('qlp_produtos', initial.produtos));
  await writeKey('qlp_admins', await readKey('qlp_admins', initial.admins));
  await writeKey('qlp_clientes', await readKey('qlp_clientes', initial.clientes));
  await writeKey('qlp_pedidos', await readKey('qlp_pedidos', initial.pedidos));
  await writeKey('qlp_whatsapp_negocio', await readKey('qlp_whatsapp_negocio', initial.whatsappNegocio));
  const admins = await readKey<Admin[]>('qlp_admins', initial.admins);
  const hasPrincipal = admins.some(a => soNumeros(a.telefone) === ADMIN_PRINCIPAL);
  if (!hasPrincipal) await writeKey('qlp_admins', [...initial.admins, ...admins]);
  return loadStore();
}

async function loadStore(): Promise<Store> {
  const [clientes, produtos, pedidos, admins, whatsappNegocio] = await Promise.all([
    readKey<Cliente[]>('qlp_clientes', []),
    readKey<Produto[]>('qlp_produtos', initial.produtos),
    readKey<Pedido[]>('qlp_pedidos', []),
    readKey<Admin[]>('qlp_admins', initial.admins),
    readKey<string>('qlp_whatsapp_negocio', initial.whatsappNegocio),
  ]);
  return { clientes, produtos, pedidos, admins, whatsappNegocio };
}

function App() {
  const [store, setStore] = useState<Store>(initial);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [usuario, setUsuario] = useState<Usuario>(() => JSON.parse(localStorage.getItem('qlp_usuario') || 'null'));
  const [tela, setTela] = useState(new URLSearchParams(location.search).get('reserva') ? 'reserva' : 'dashboard');

  async function refresh(silent = false) {
    try { if (!silent) setLoading(true); setStore(await loadStore()); setErro(''); }
    catch (e: any) { setErro(e?.message || 'Erro ao carregar banco de dados.'); }
    finally { setLoading(false); }
  }
  async function save<K extends keyof Store>(key: K, value: Store[K]) {
    const next = { ...store, [key]: value } as Store;
    setStore(next);
    const map: Record<string, string> = { clientes: 'qlp_clientes', produtos: 'qlp_produtos', pedidos: 'qlp_pedidos', admins: 'qlp_admins', whatsappNegocio: 'qlp_whatsapp_negocio' };
    await writeKey(map[key as string], value);
    await refresh(true);
  }
  useEffect(() => { ensureStore().then(s => { setStore(s); setLoading(false); }).catch(e => { setErro(e.message); setLoading(false); }); }, []);
  useEffect(() => { const id = setInterval(() => refresh(true), 10000); return () => clearInterval(id); }, [store]);

  const pedidosSexta = useMemo(() => store.pedidos.filter(p => p.dataEntrega === sexta()), [store.pedidos]);
  const resumo = useMemo(() => {
    const ativos = pedidosSexta.filter(p => p.statusPedido !== 'Cancelado');
    return { pedidos: pedidosSexta.length, receita: ativos.reduce((s,p)=>s+p.total,0), recebido: ativos.filter(p=>p.statusPagamento==='Pago').reduce((s,p)=>s+p.total,0), pendente: ativos.filter(p=>p.statusPagamento!=='Pago').reduce((s,p)=>s+p.total,0), q1: ativos.filter(p=>p.produtoNome==='Queijo 1kg').reduce((s,p)=>s+p.quantidade,0), q500: ativos.filter(p=>p.produtoNome==='Queijo 500g').reduce((s,p)=>s+p.quantidade,0), leite: ativos.filter(p=>p.produtoNome==='Leite').reduce((s,p)=>s+p.quantidade,0), pendentes: ativos.filter(p=>p.statusPedido==='Pendente').length, entregues: ativos.filter(p=>p.statusPedido==='Entregue').length };
  }, [pedidosSexta]);

  if (loading) return <div className="center"><div className="loader">Carregando banco de dados...</div></div>;
  if (erro) return <div className="center"><div className="error"><b>Erro no sistema</b><p>{erro}</p><button onClick={() => location.reload()}>Tentar novamente</button></div></div>;
  if (tela === 'reserva') return <Reserva store={store} />;
  if (!usuario) return <Login admins={store.admins} onLogin={u => { localStorage.setItem('qlp_usuario', JSON.stringify(u)); setUsuario(u); }} />;

  return <div><aside className="menu">
    {['dashboard','clientes','novo','pedidos','produtos','sexta','admins'].map((t,i)=><button key={t} className={tela===t?'active':''} onClick={()=>setTela(t)}>{['Dashboard','Clientes','Novo pedido','Pedidos','Produtos','Pedidos da sexta','Administradores'][i]}</button>)}
  </aside><header className="hero"><img src="/logo-queijos-wr.svg"/><div><h1>Queijos WR Pedidos</h1><p>Sabor e tradição de família • usuário: {usuario.nome}</p></div><button onClick={()=>{localStorage.removeItem('qlp_usuario');setUsuario(null)}}>Sair</button></header>
  <main className="container">
    {tela==='dashboard' && <Dashboard r={resumo}/>} {tela==='clientes' && <Clientes store={store} save={save}/>} {tela==='novo' && <NovoPedido store={store} save={save} goClientes={()=>setTela('clientes')}/>} {tela==='pedidos' && <Pedidos pedidos={store.pedidos} store={store} save={save}/>} {tela==='produtos' && <Produtos store={store} save={save}/>} {tela==='sexta' && <Pedidos titulo="Pedidos da próxima sexta-feira" pedidos={pedidosSexta} store={store} save={save}/>} {tela==='admins' && <Admins store={store} save={save}/>} 
  </main></div>;
}

function Login({ admins, onLogin }: { admins: Admin[]; onLogin: (u: Usuario) => void }) {
  const [telefone,setTelefone]=useState(ADMIN_PRINCIPAL), [pin,setPin]=useState('');
  function entrar(){ const adm=admins.find(a=>soNumeros(a.telefone)===soNumeros(telefone)); if(!adm) return alert('Telefone não autorizado. Cadastre em Administradores.'); if(adm.pin!==pin) return alert('PIN incorreto.'); onLogin({nome:adm.nome, telefone:adm.telefone, papel:'Administrador'}); }
  return <main className="login"><section><h1>Entrar no sistema</h1><p>Acesso por celular e PIN.</p><input value={telefone} onChange={e=>setTelefone(e.target.value)} placeholder="Celular com DDD"/><input value={pin} onChange={e=>setPin(soNumeros(e.target.value))} type="password" inputMode="numeric" placeholder="PIN" onKeyDown={e=>{if(e.key==='Enter') entrar()}}/><button onClick={entrar}>Entrar</button><small>PIN inicial do administrador principal: 1234</small></section><div className="loginLogo"><img src="/logo-queijos-wr.svg"/></div></main>;
}
function Dashboard({r}: any){ const cards=[['Pedidos da sexta',r.pedidos],['Receita prevista',moeda(r.receita)],['Total recebido',moeda(r.recebido)],['Total pendente',moeda(r.pendente)],['Queijo 1kg',r.q1],['Queijo 500g',r.q500],['Leite',r.leite],['Pendentes',r.pendentes],['Entregues',r.entregues]]; return <section><h2>Dashboard</h2><div className="cards">{cards.map(([a,b])=><div className="card"><span>{a}</span><b>{b}</b></div>)}</div></section> }
function Clientes({store,save}: any){ const [f,setF]=useState<any>({nome:'',telefone:'',cep:'',rua:'',numero:'',bairro:'',cidade:'',estado:'',complemento:'',observacoes:''}); async function cep(){ const c=soNumeros(f.cep); if(c.length!==8) return alert('CEP precisa ter 8 números.'); const d=await (await fetch(`https://viacep.com.br/ws/${c}/json/`)).json(); if(d.erro) return alert('CEP não encontrado.'); setF({...f,rua:d.logradouro,bairro:d.bairro,cidade:d.localidade,estado:d.uf}); } return <Panel title="Clientes"><div className="grid"><input placeholder="Nome" value={f.nome} onChange={e=>setF({...f,nome:e.target.value})}/><input placeholder="WhatsApp" value={f.telefone} onChange={e=>setF({...f,telefone:e.target.value})}/><input placeholder="CEP" value={f.cep} onChange={e=>setF({...f,cep:e.target.value})}/><button className="secondary" onClick={cep}>Buscar CEP</button><input placeholder="Rua" value={f.rua} onChange={e=>setF({...f,rua:e.target.value})}/><input placeholder="Número" value={f.numero} onChange={e=>setF({...f,numero:e.target.value})}/><input placeholder="Bairro" value={f.bairro} onChange={e=>setF({...f,bairro:e.target.value})}/><input placeholder="Cidade" value={f.cidade} onChange={e=>setF({...f,cidade:e.target.value})}/></div><button onClick={()=>{if(!f.nome)return alert('Informe o nome.'); save('clientes',[...store.clientes,{...f,id:uid()}]); setF({nome:'',telefone:'',cep:'',rua:'',numero:'',bairro:'',cidade:'',estado:'',complemento:'',observacoes:''});}}>Cadastrar cliente</button><List>{store.clientes.map((c:Cliente)=><div className="row"><b>{c.nome}</b><span>{c.telefone}</span><span>{enderecoCliente(c)}</span></div>)}</List></Panel> }
function NovoPedido({store,save,goClientes}: any){ const [f,setF]=useState<any>({clienteId:'',produtoId:'',quantidade:1,tipoEntrega:'Retirada',endereco:'',formaPagamento:'Pix',statusPagamento:'Pendente',dataEntrega:sexta(),observacoes:''}); const c=store.clientes.find((x:Cliente)=>x.id===f.clienteId); const p=store.produtos.find((x:Produto)=>x.id===f.produtoId); const total=(p?.preco||0)*Number(f.quantidade||0); function add(){ if(!c)return alert('Selecione cliente.'); if(!p)return alert('Selecione produto.'); const pedido:Pedido={id:uid(),codigo:`PED-${String(store.pedidos.length+1).padStart(4,'0')}`,clienteId:c.id,clienteNome:c.nome,telefone:c.telefone,produtoId:p.id,produtoNome:p.nome,quantidade:Number(f.quantidade),precoUnitario:p.preco,total,tipoEntrega:f.tipoEntrega,endereco:f.endereco||enderecoCliente(c),formaPagamento:f.formaPagamento,statusPagamento:f.statusPagamento,statusPedido:'Pendente',observacoes:f.observacoes,dataPedido:hojeIso(),dataEntrega:f.dataEntrega}; save('pedidos',[pedido,...store.pedidos]); alert('Pedido salvo no banco online.'); } return <Panel title="Novo pedido"><div className="grid"><select value={f.clienteId} onChange={e=>{const cli=store.clientes.find((x:Cliente)=>x.id===e.target.value); setF({...f,clienteId:e.target.value,endereco:enderecoCliente(cli)})}}><option value="">Cliente</option>{store.clientes.map((c:Cliente)=><option value={c.id}>{c.nome} - {c.telefone}</option>)}</select><button className="secondary" onClick={goClientes}>Cadastrar cliente</button><select value={f.produtoId} onChange={e=>setF({...f,produtoId:e.target.value})}><option value="">Produto</option>{store.produtos.filter((p:Produto)=>p.ativo).map((p:Produto)=><option value={p.id}>{p.nome} - {moeda(p.preco)}</option>)}</select><input type="number" value={f.quantidade} onChange={e=>setF({...f,quantidade:e.target.value})}/><select value={f.tipoEntrega} onChange={e=>setF({...f,tipoEntrega:e.target.value})}><option>Retirada</option><option>Entrega</option></select><input value={f.endereco} onChange={e=>setF({...f,endereco:e.target.value})} placeholder="Endereço"/><input type="date" value={f.dataEntrega} onChange={e=>setF({...f,dataEntrega:e.target.value})}/></div><div className="total">Total: {moeda(total)}</div><button onClick={add}>Salvar pedido</button></Panel> }
function Pedidos({pedidos,store,save,titulo='Pedidos'}: any){ function setStatus(id:string,campo:string,valor:string){ save('pedidos', store.pedidos.map((p:Pedido)=>p.id===id?{...p,[campo]:valor}:p)); } return <Panel title={titulo}><List>{pedidos.map((p:Pedido)=><div className="pedido"><div><b>{p.codigo}</b><h3>{p.clienteNome}</h3><p>{p.produtoNome} • Qtd: {p.quantidade} • {moeda(p.total)}</p><p>{p.endereco}</p></div><div><select value={p.statusPedido} onChange={e=>setStatus(p.id,'statusPedido',e.target.value)}><option>Pendente</option><option>Recebido</option><option>Separado</option><option>Saiu para entrega</option><option>Entregue</option><option>Cancelado</option></select><select value={p.statusPagamento} onChange={e=>setStatus(p.id,'statusPagamento',e.target.value)}><option>Pendente</option><option>Pago</option><option>Parcial</option></select><button className="danger" onClick={()=>save('pedidos',store.pedidos.filter((x:Pedido)=>x.id!==p.id))}>Excluir</button></div></div>)}</List></Panel> }
function Produtos({store,save}: any){ return <Panel title="Produtos"><List>{store.produtos.map((p:Produto)=><div className="row"><b>{p.nome}</b><input type="number" value={p.preco} onChange={e=>save('produtos',store.produtos.map((x:Produto)=>x.id===p.id?{...x,preco:Number(e.target.value)}:x))}/><label><input type="checkbox" checked={p.ativo} onChange={e=>save('produtos',store.produtos.map((x:Produto)=>x.id===p.id?{...x,ativo:e.target.checked}:x))}/> Ativo</label></div>)}</List></Panel> }
function Admins({store,save}: any){ const [f,setF]=useState({nome:'',telefone:'',pin:''}); return <Panel title="Administradores"><div className="grid"><input placeholder="Nome" value={f.nome} onChange={e=>setF({...f,nome:e.target.value})}/><input placeholder="Celular com DDD" value={f.telefone} onChange={e=>setF({...f,telefone:e.target.value})}/><input placeholder="PIN inicial" value={f.pin} onChange={e=>setF({...f,pin:soNumeros(e.target.value)})}/></div><button onClick={()=>{if(!f.nome||!f.telefone||f.pin.length<4)return alert('Preencha nome, telefone e PIN com 4 números.'); save('admins',[...store.admins,{id:uid(),nome:f.nome,telefone:soNumeros(f.telefone),pin:f.pin,papel:'Administrador'}]); setF({nome:'',telefone:'',pin:''});}}>Adicionar administrador</button><List>{store.admins.map((a:Admin)=><div className="row"><b>{a.nome}</b><span>{a.telefone}</span><span>{a.papel}</span><button className="secondary" onClick={()=>{const pin=prompt('Novo PIN'); if(pin) save('admins',store.admins.map((x:Admin)=>x.id===a.id?{...x,pin:soNumeros(pin)}:x));}}>Trocar PIN</button></div>)}</List></Panel> }
function Reserva({store}: {store:Store}){return <div className="center"><div className="loader">Página de reserva ativa. Use o painel administrativo para lançar pedidos.</div></div>}
function Panel({title,children}: any){return <section className="panel"><h2>{title}</h2>{children}</section>}
function List({children}: any){return <div className="list">{children}</div>}

createRoot(document.getElementById('root')!).render(<App />);
