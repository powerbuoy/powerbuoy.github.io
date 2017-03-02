import {bindable, inlineView} from 'aurelia-framework';

@inlineView('<template><popup name="confirm" buttons.bind="buttons" is-open.bind="isOpen">${text}</popup></template>')
export class ConfirmCustomElement {
	@bindable isOpen = false;
	@bindable onOk = null;
	@bindable onCancel = null;
	@bindable text = '';

	constructor () {
		this.buttons = [
			{
				title: 'Ok',
				keyCode: 13,
				action: popup => {
					popup.close();

					if (typeof this.onOk === 'function') {
						this.onOk();
					}
				}
			},
			{
				title: 'Avbryt',
				keyCode: 27,
				cssClasses: 'button--ghost',
				action: popup => {
					popup.close();

					if (typeof this.onCancel === 'function') {
						this.onCancel();
					}
				}
			}
		];
	}

	show (text, onOk, onCancel) {
		this.text = text;
		this.isOpen = true;
		this.onOk = onOk;
		this.onCancel = onCancel;
	}
}
