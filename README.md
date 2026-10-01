# Liberador de rotas do qbank

Ferramenta local para consultar e liberar rotas do `app-qbank-api` nas tabelas `perfil`, `perfil_recurso`, `perfil_recurso_escopo` e `perfil_controle`.

Ela roda na sua máquina. A senha e o token IAM ficam no `localStorage` do navegador e só saem dali para o MySQL que você apontar. Nada disso entra no git.

## Pré-requisitos

- Node.js 20 ou mais novo
- [pnpm](https://pnpm.io) 11 (`packageManager` do projeto é `pnpm@11.5.1`)
- Acesso de leitura e escrita ao MySQL do qbank, em geral por um túnel até o RDS
- Se o banco usa autenticação IAM da AWS, um token novo. Ele expira em cerca de 15 minutos

O app não sobe banco, não usa Docker e não precisa de `.env`.

## Como rodar

```bash
pnpm install
pnpm dev
```

Abra [http://localhost:3000](http://localhost:3000). Para outra porta:

```bash
pnpm dev --port 3210
```

Na primeira tela, conecte no banco. Se o teste passar, a conexão fica salva neste navegador e o cabeçalho mostra `host:porta / database`.

## Conectar no banco

Dá para preencher campo a campo ou colar uma string `mysql://`.

A string segue o formato usual. A senha pode ser um token IAM já escapado para URL:

```text
mysql://usuario:senha@127.0.0.1:26524/medcof?sslmode=require
```

O parser liga sozinho:

- SSL, salvo `sslmode=disable`
- o plugin de cleartext do MySQL, quando a senha parece token IAM (`Action=connect` ou `X-Amz-Algorithm`)

Os dois checkboxes continuam editáveis se precisar forçar o contrário.

Quando o token expirar, o ping responde acesso negado. Abra **Conexão** e troque só a senha, ou cole a string nova. **Esquecer conexão** apaga o que está no `localStorage`.

## Telas

| Rota | Para que serve |
| --- | --- |
| `/rotas` | Rotas já liberadas, com busca por id, path, observação, método, escopo e perfil |
| `/escopos` | Escopos não removidos, com busca por id e nome |
| `/liberar` | Incluir uma ou várias rotas, ou só vincular perfis que ainda não têm a rota |

As buscas esperam ~300 ms antes de consultar. A paginação é de 20 ou 50 itens.

## Liberar uma rota

1. Marque os perfis. O perfil 5 (Super Administrador) passa no middleware sem olhar a tabela. Ele ainda pode ser marcado para a migration ficar completa.
2. Escolha o escopo e a application. Qbank é `1`.
3. Em cada fileira: método, path e observação. **+** abre outra rota. **×** remove a fileira quando há mais de uma.
4. **Analisar antes de gravar** mostra o que seria criado ou só vinculado. Nada é gravado nesse passo.
5. **Gravar** executa a transação. **Copiar SQL** e **Copiar migration Knex** geram o mesmo efeito sem passar pela tela.

Se path e método já existem, a ferramenta não altera o path. Ela só vincula os perfis que faltam e reativa vínculo removido.

A observação vai para `perfil_recurso.observacao` (máximo 100 caracteres). Se o campo ficar vazio, entra o path visível, cortado nesse limite.

### Path e regex

O middleware compara a URL assim:

```sql
WHERE :path REGEXP CONCAT('^', pr.path)
```

Por isso o valor gravado não leva `^` no começo e leva `$` no fim. Sem o `$`, `/foo` também casa com `/foo/bar`.

O que você digita no path é literal: maiúscula vira minúscula e metacaractere (`.` por exemplo) é escapado. Os atalhos entram como badge, já com o regex do banco:

| Atalho | Regex gravado |
| --- | --- |
| MongoId | `[a-fA-F0-9]{24}` |
| Numérico | `[0-9]{1,20}` |
| Numérico aberto | `[0-9]{1,}` |
| Alfanumérico | `[A-Za-z0-9]{1,100}` |
| Slug | `[a-z0-9-]{1,80}` |
| Qualquer segmento | `[^/]+` |

A badge é um caractere só. Backspace e Delete apagam o bloco inteiro. Para um padrão que não está na lista, escreva em **seu regex** e clique em **Inserir**. Esse texto também vira badge e é gravado como você escreveu.

Exemplo: `/v3/qbank/` + badge Numérico + `/reset` grava

```text
/v3/qbank/[0-9]{1,20}/reset$
```

Abaixo do campo aparece o path que de fato vai para o banco. **Testar uma URL** roda o mesmo `REGEXP` do middleware. Se mais de uma rota casar, o middleware usa `LIMIT 1` sem ordem, então o perfil pode receber a linha errada. A tela avisa. Não esconde o caso.

## O que esta versão não faz

- editar o path de uma rota que já existe
- apagar rota ou vínculo
- criar escopo ou perfil

## Testes

```bash
pnpm test
pnpm exec tsc --noEmit
pnpm lint
```

Os testes cobrem o parser da string MySQL, a montagem do regex e o comportamento da badge. Não há teste que grave no banco.

## Segurança

- Não commite string de conexão, token, `.env` ou certificado (`.env*` e `*.pem` já estão no `.gitignore`).
- A API deste app só existe para o `next dev` / `next start` na sua máquina. O body leva a senha até esse servidor local, que abre uma conexão por request e fecha em seguida.
- Confira host e database no cabeçalho antes de gravar. O preview é o último passo sem escrita.
