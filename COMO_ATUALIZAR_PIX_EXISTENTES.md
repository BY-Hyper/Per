# 🔄 ATUALIZAR TRANSAÇÕES PIX EXISTENTES

## 🚨 Problema Encontrado

As transações PIX **já importadas** continuam mostrando como "TRANSFERENCIA PIX" porque foram importadas **antes** de você adicionar os beneficiários ao sistema.

**Solução:** Usar o novo `PIX_UPDATER` para atualizar todas as transações.

---

## ✅ Como Atualizar (2 Passos)

### **Passo 1: Adicionar o Script**

Abra seu `index.html` e adicione:

```html
<script src="fp-pix-enrichment.js"></script>
<script src="fp-pix-manager-ui.js"></script>
<script src="fp-pix-updater.js"></script>  <!-- ← NOVO -->
```

### **Passo 2: Atualizar as Transações**

No console do navegador (F12 → Console), execute:

```javascript
// Atualizar TODAS as transações PIX
PIX_UPDATER.updateAllPixTransactions()
```

**Resultado esperado:**
```
🔄 Iniciando atualização de transações PIX...
  ✓ 2026-02-14: PIX para João Silva
  ✓ 2026-02-15: PIX para Maria Santos
  ✓ 2026-02-17: PIX para Supermercado XYZ
✅ Atualização concluída: 3 transação(ões) atualizada(s)
```

---

## 🔍 Ver Quais Precisam Ser Mapeadas

Se ainda há PIX sem nome, execute:

```javascript
// Ver quais não estão mapeadas
PIX_UPDATER.findUnmappedPixTransactions()
```

Resultado:
```javascript
[
  { id: 123, date: '2026-02-14', amount: 95, pixCode: '1601370', description: 'PIX - Ref: 1601370' },
  { id: 124, date: '2026-02-15', amount: 50, pixCode: '1625405', description: 'PIX - Ref: 1625405' }
]
```

---

## 🎯 Fluxo Completo

### **1. Adicione beneficiários primeiro:**
```javascript
FP_PIX_ENRICHMENT.addBeneficiary('1601370', 'João Silva');
FP_PIX_ENRICHMENT.addBeneficiary('1625405', 'Maria Santos');
FP_PIX_ENRICHMENT.addBeneficiary('1934251', 'Telecom Brasil');
```

### **2. Depois atualize as transações:**
```javascript
PIX_UPDATER.updateAllPixTransactions()
```

### **3. Verificar se faltam:**
```javascript
PIX_UPDATER.findUnmappedPixTransactions()
```

---

## 📊 Antes vs Depois da Atualização

### ANTES:
```
14/02 | TRANSFERENCIA PIX | R$ 95 | ❌ Sem saber para quem
15/02 | TRANSFERENCIA PIX | R$ 50 | ❌ Sem saber para quem
17/02 | TRANSFERENCIA PIX | R$ 40 | ❌ Sem saber para quem
```

### DEPOIS:
```
14/02 | PIX para João Silva | R$ 95 | ✅ Identificado
15/02 | PIX para Maria Santos | R$ 50 | ✅ Identificado
17/02 | PIX para Supermercado XYZ | R$ 40 | ✅ Identificado
```

---

## 🛠️ Funções Disponíveis

### **updateAllPixTransactions()**
Atualiza todas as transações PIX com beneficiários mapeados.

```javascript
await PIX_UPDATER.updateAllPixTransactions()
```

**Resultado:** Número de transações atualizadas

---

### **findUnmappedPixTransactions()**
Encontra todas as transações PIX sem beneficiário mapeado.

```javascript
const unmapped = await PIX_UPDATER.findUnmappedPixTransactions()
```

**Resultado:** Array com transações não mapeadas

---

### **updatePixTransaction(id, beneficiary)**
Atualizar uma transação específica.

```javascript
await PIX_UPDATER.updatePixTransaction(123, 'João Silva')
```

---

### **showUnmappedPixModal()**
Mostrar modal com transações não mapeadas.

```javascript
await PIX_UPDATER.showUnmappedPixModal()
```

---

## ⚡ Ordem Recomendada

1. ✅ **Abra o PIX Manager:**
   ```javascript
   PIX_MANAGER.show()
   ```

2. ✅ **Adicione todos os beneficiários que você conhece**

3. ✅ **Exporte como backup:**
   - Clique botão "Exportar" no PIX Manager

4. ✅ **Atualizar transações:**
   ```javascript
   PIX_UPDATER.updateAllPixTransactions()
   ```

5. ✅ **Verificar o que falta:**
   ```javascript
   PIX_UPDATER.showUnmappedPixModal()
   ```

6. ✅ **Adicionar faltantes:**
   - Abra app Bradesco
   - Verifique cada PIX não mapeado
   - Adicione ao PIX Manager

7. ✅ **Atualizar novamente:**
   ```javascript
   PIX_UPDATER.updateAllPixTransactions()
   ```

---

## 🎁 Extras

### Copiar códigos PIX não mapeados

```javascript
const unmapped = await PIX_UPDATER.findUnmappedPixTransactions();
const codes = unmapped.map(t => t.pixCode).join('\n');
console.log(codes);
copy(codes);  // Copia para clipboard
```

### Atualizar automaticamente ao abrir

Adicione isto ao final do seu app (onde inicia):

```javascript
// Auto-atualizar PIX ao carregar
if (window.PIX_UPDATER) {
  PIX_UPDATER.updateAllPixTransactions().catch(e => console.warn('PIX update skip', e));
}
```

---

## ✅ Checklist

- [ ] Script `fp-pix-updater.js` adicionado ao HTML
- [ ] Beneficiários adicionados via PIX_MANAGER
- [ ] Executou `PIX_UPDATER.updateAllPixTransactions()`
- [ ] Verificou transações no dashboard (agora com nomes)
- [ ] Exportou backup dos beneficiários
- [ ] Adicionou PIX faltantes e re-atualizou

---

## 📞 Suporte

**Problema: "PIX_UPDATER não existe"**
- Verifique se `fp-pix-updater.js` foi adicionado ao HTML

**Problema: "Transações não foram atualizadas"**
- Recarregue a página (F5)
- Verifique se os códigos PIX estão corretos no PIX_MANAGER
- Use `console.log(FP_PIX_ENRICHMENT.beneficiaries)` para verificar

**Problema: "Dados desapareceram"**
- localStorage foi limpo
- Use arquivo de backup JSON que exportou anteriormente
- PIX_MANAGER tem botão "Importar"

---

**Status:** ✅ RESOLVIDO
**Data:** 2026-06-10
