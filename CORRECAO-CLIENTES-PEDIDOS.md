# Correção aplicada: Clientes e Pedidos separados

Arquivo alterado:

- `src/routes/_authenticated/pedidos.novo.tsx`

O que mudou:

1. A tela **Novo pedido** não cria mais cliente automaticamente.
2. O usuário precisa selecionar um **cliente já cadastrado**.
3. O nome e telefone vêm do cadastro do cliente e ficam somente leitura no pedido.
4. Foi adicionado o botão **Cadastrar cliente** dentro da tela de novo pedido, levando para a tela `Clientes`.
5. Para entrega, o endereço vem do cadastro do cliente, mas pode ser ajustado no próprio pedido.
6. Se não houver cliente selecionado, o sistema mostra aviso e não salva o pedido.

Fluxo correto agora:

1. Vá em **Clientes**.
2. Cadastre o cliente uma vez.
3. Vá em **Novo pedido**.
4. Selecione o cliente cadastrado.
5. Escolha produto, quantidade, pagamento e salve o pedido.

Assim você não precisa cadastrar um novo cliente toda vez que for lançar um pedido.
