# 🎯 Guia Prático: Identificar Beneficiários PIX no Bradesco

## 📋 Resumo do Problema

Ao importar extratos do Bradesco, transações PIX aparecem assim:
```
❌ Descrição: PIX - Ref: 1601370
❌ Payee: (vazio)
```

Você não sabe para quem foi transferido o dinheiro.

---

## ✅ Solução em 3 Passos

### **Passo 1: Identificar no App Bradesco**

1. Abra o **App/Site do Bradesco**
2. Vá para **"Meu Bradesco" → Histórico**
3. Procure a transação PIX com o mesmo valor e data
4. **Clique na transação** para ver detalhes
5. Veja o nome/CPF do beneficiário

**Exemplo:**
```
Transação: PIX enviado em 14/02/2025 R$ 95,00
Beneficiário: João Silva
CPF: XXX.XXX.XXX-XX
```

---

### **Passo 2: Adicionar ao FinancePro**

#### **Opção A: Via Console (Mais Rápido)**

1. Abra o FinancePro no navegador
2. Pressione **F12** para abrir DevTools
3. Clique em **"Console"**
4. Cole o código para cada PIX:

```javascript
// Adicionar um beneficiário
FP_PIX_ENRICHMENT.addBeneficiary('1601370', 'João Silva');
FP_PIX_ENRICHMENT.addBeneficiary('1625405', 'Maria Santos');
FP_PIX_ENRICHMENT.addBeneficiary('1934251', 'Telecom Brasil');

// Verificar todos salvos
console.log(FP_PIX_ENRICHMENT.beneficiaries);
```

5. Pressione **Enter**

#### **Opção B: Interface (Será Implementada)**

Será adicionada uma interface visual para:
- [ ] Lista de PIX não mapeados
- [ ] Formulário para adicionar beneficiários
- [ ] Busca por valor/data

---

### **Passo 3: Re-importar ou Validar**

Após adicionar os beneficiários:

- **Novas importações** virão com nomes
- **Transações já importadas** precisam ser reatualizadas manualmente

**Resultado:**
```
✅ Descrição: PIX para João Silva
✅ Payee: João Silva
✅ Valor: R$ 95,00
✅ Data: 14/02/2025
```

---

## 📚 Exemplo Completo

### Seu Extrato do Bradesco:
```
Data       | Histórico           | Docto.  | Débito
14/02/2025 | TRANSFERENCIA PIX    | 1601370 | 95,00
14/02/2025 | TRANSFERENCIA PIX    | 1625405 | 50,00
17/02/2025 | TRANSFERENCIA PIX    | 1307553 | 40,00
```

### Você Verifica no App:
```
1601370 → João Silva (Colega de trabalho)
1625405 → Maria Santos (Irmã)
1307553 → Supermercado XYZ
```

### Você Adiciona ao FinancePro:
```javascript
FP_PIX_ENRICHMENT.addBeneficiary('1601370', 'João Silva');
FP_PIX_ENRICHMENT.addBeneficiary('1625405', 'Maria Santos');
FP_PIX_ENRICHMENT.addBeneficiary('1307553', 'Supermercado XYZ');
```

### Resultado no FinancePro:
```
14/02/2025 | PIX para João Silva      | R$ 95,00
14/02/2025 | PIX para Maria Santos    | R$ 50,00
17/02/2025 | PIX para Supermercado XYZ| R$ 40,00
```

---

## 💾 Dados Salvos Automaticamente

Os beneficiários são salvos em:
- **LocalStorage do navegador**
- **Persistem entre sessões**
- **Sincronizam automaticamente**

### Backup/Exportar:
```javascript
// Ver todos os mapeamentos
console.log(JSON.stringify(FP_PIX_ENRICHMENT.beneficiaries, null, 2));

// Salvar em arquivo
copy(JSON.stringify(FP_PIX_ENRICHMENT.beneficiaries));
```

---

## 🔄 Fluxo Mensal Recomendado

### **1ª Vez (Mais Trabalhoso)**
- [ ] Importar extrato do Bradesco
- [ ] Ver todos os PIX não mapeados
- [ ] Consultar app Bradesco para cada código
- [ ] Adicionar 10-20 beneficiários novos

### **Próximas Vezes (Rápido)**
- [ ] Importar extrato do Bradesco
- [ ] Sistema reconhece beneficiários conhecidos
- [ ] Adiciona apenas PIX novos (geralmente 1-5)

---

## 🚀 Próximas Melhorias Planejadas

- [ ] Interface visual para gerenciar PIX
- [ ] Importar/Exportar lista de beneficiários
- [ ] Sincronizar entre dispositivos
- [ ] Integração com API do Bradesco (se disponível)
- [ ] Histórico de quem recebe de você

---

## ❓ Dúvidas Frequentes

**P: Os dados vão desaparecer se limpar cache?**
R: Sim. Vamos implementar backup automático em breve.

**P: Posso compartilhar meu mapeamento?**
R: Sim! Use a função `copy()` para exportar e compartilhar.

**P: E se o PIX for para um novo beneficiário?**
R: Simples - adicione o novo código! O sistema aprenderá.

**P: Funciona para outros bancos?**
R: Pode ser adaptado. Prioritário é Bradesco por enquanto.

---

## 📞 Suporte

Precisa de ajuda?
1. Verifique se `fp-pix-enrichment.js` está carregado
2. Teste no console: `FP_PIX_ENRICHMENT` (deve mostrar o objeto)
3. Verifique LocalStorage: `localStorage.getItem('FP_PIX_BENEFICIARIES')`

---

**Última atualização:** 2026-06-10
**Status:** ✅ Funcional | 🔄 Melhorias Planejadas
