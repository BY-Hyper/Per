# Solução: Identificar Beneficiários em Transferências PIX do Bradesco

## 🚨 Problema

O CSV exportado pelo Bradesco **não inclui o nome/CPF/CNPJ do beneficiário** nas transações PIX.

### Dados Disponíveis no CSV do Bradesco:
```
Data       | Histórico           | Docto.  | Crédito | Débito | Saldo
14/02/2025 | TRANSFERENCIA PIX    | 1601370 |         | 95,00  | 100,00
14/02/2025 | TRANSFERENCIA PIX    | 1625405 |         | 50,00  | 50,00
```

❌ **Não há informação de para quem foi transferido**

---

## ✅ Soluções Disponíveis

### **Opção 1: Usar Aplicativo do Bradesco para Detalhar**

O Bradesco não fornece essa informação no CSV, mas **você pode acessar**:

1. **Abra o app/site do Bradesco**
2. **Vá para "Meu Bradesco" → Histórico**
3. **Clique em cada transação PIX**
4. **Visualize o beneficiário** (mostra CPF/CNPJ/chave PIX)
5. **Anote o nome** para adicionar ao sistema

### **Opção 2: Sistema de Mapeamento Local** ✅ IMPLEMENTADO

Arquivo criado: `fp-pix-enrichment.js`

**Como usar:**

```javascript
// Adicionar beneficiário
FP_PIX_ENRICHMENT.addBeneficiary('1601370', 'João Silva');
FP_PIX_ENRICHMENT.addBeneficiary('1625405', 'Maria Santos');

// Sistema lembrará automaticamente
// Próxima vez que importar será enriquecida
```

**Vantagens:**
- ✅ Funciona offline
- ✅ Aprende com o tempo
- ✅ Sincroniza entre sessões
- ✅ Fácil de adicionar novos nomes

### **Opção 3: Usar OFX ao invés de CSV**

O Bradesco oferece exportação em formato OFX que às vezes tem mais detalhes:

1. No Bradesco: **Extrato → Opções → Formato OFX**
2. Importar no FinancePro
3. Verificar se inclui beneficiário

---

## 📋 Implementação do Mapeamento

### **Arquivo: `fp-pix-enrichment.js`**

Adicione ao seu `index.html`:

```html
<script src="fp-pix-enrichment.js"></script>
```

### **Preencher Beneficiários:**

```javascript
// No console do navegador ou em seu código:
FP_PIX_ENRICHMENT.addBeneficiary('1601370', 'João Silva - Empréstimo');
FP_PIX_ENRICHMENT.addBeneficiary('1625405', 'Maria Santos - Aluguel');
FP_PIX_ENRICHMENT.addBeneficiary('1934251', 'Telecom Brasil - Internet');

// Ver todos
console.log(FP_PIX_ENRICHMENT.beneficiaries);
```

### **Antes vs Depois:**

```
ANTES:
Descrição: PIX - Ref: 1601370
Payee: PIX - Ref: 1601370

DEPOIS (após mapear):
Descrição: PIX para João Silva - Empréstimo
Payee: João Silva - Empréstimo
```

---

## 🔄 Fluxo Recomendado

### **1ª Importação:**
- [ ] Importar CSV Bradesco no sistema
- [ ] Transações PIX aparecem como "PIX - Ref: XXXXX"
- [ ] Anotar os códigos e verificar no app Bradesco

### **2ª Etapa - Mapeamento:**
- [ ] Para cada PIX, identificar beneficiário no app
- [ ] Adicionar ao sistema usando `addBeneficiary()`
- [ ] Salva automaticamente em localStorage

### **3ª Importação em Diante:**
- [ ] Sistema reconhecerá automaticamente
- [ ] Transações ficarão com nome do beneficiário

---

## 📊 Exemplo Prático

**Seu extrato Bradesco mostra:**
```
14/02/2025 | PIX | 1601370 | -95,00
```

**Você verifica no app Bradesco:**
- Clica na transação
- Vê: "João Silva - CPF: XXX.XXX.XXX-XX"

**Você adiciona ao sistema:**
```javascript
FP_PIX_ENRICHMENT.addBeneficiary('1601370', 'João Silva');
```

**Resultado:**
```
Descrição: PIX para João Silva
Payee: João Silva
Data: 14/02/2025
Valor: R$ 95,00
```

---

## 🎯 Melhorias Futuras

### **Integração com API Bradesco**
Se Bradesco liberar acesso a API:
- Buscar informações de beneficiário automaticamente
- Sincronizar CPF/CNPJ
- Validar transações

### **Integração com Sistema PIX**
- Verificar chave PIX no DICT (Diretório de Identificadores)
- Enriquecer com dados públicos do beneficiário

### **Interface de Gerenciamento**
- Painel para mapear beneficiários
- Histórico de transações por beneficiário
- Sugestões automáticas

---

## ⚠️ Limitações Atuais

| Funcionalidade | Status | Observação |
|---|---|---|
| Nome beneficiário no CSV | ❌ Não | Bradesco não fornece |
| CPF/CNPJ beneficiário | ❌ Não | Disponível apenas no app |
| Chave PIX | ❌ Não | Não exportada no CSV |
| OFX com detalhes | ⚠️ Talvez | Depende do tipo de conta |
| Mapeamento local | ✅ Sim | Implementado |
| Sincronização cloud | ❌ Não | Pode ser implementado |

---

## 🔗 Próximos Passos

1. **Integre `fp-pix-enrichment.js` no projeto**
2. **Crie interface para adicionar beneficiários**
3. **Implemente persistência (localStorage/DB)**
4. **Adicione busca por beneficiário**
5. **Considere API do Bradesco no futuro**

---

## 📞 Suporte

**Dúvidas?**
- Verificar documentação do Bradesco sobre exportação
- Consultar API PIX do Banco Central
- Testar formato OFX para mais detalhes
