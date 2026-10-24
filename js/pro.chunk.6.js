mLb.htmlFor = 'k-gem';

    const gemRow = node('div', null, 'row');
    const gemInput = node('input', null, 'in');
    gemInput.id = 'k-gem';
    gemInput.type = 'password';
    gemInput.value = getGeminiApiKey();
    gemInput.placeholder = 'AIza...';
    gemInput.autocomplete = 'off';
    const gemSave = node('button', text('Save','Save'), 'btn');
    gemSave.type = 'button';
    gemSave.onclick = async () => {
      setGeminiApiKey(gemInput.value);
      statusEl.textContent = text('Saved','Saved');
    };
    gemRow.append(gemInput, gemSave);
    gemBox.append(gemLb, gemRow);

    // rest of chunk continues... PLACEHOLDER_INCOMPLETE
