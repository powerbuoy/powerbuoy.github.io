import {bindable, inlineView} from 'aurelia-framework';

@inlineView('<template><popup name="alert" buttons.bind="buttons" is-open.bind="isOpen">${text}</popup></template>')
export class AlertCustomElement {
	@bindable isOpen = false;
	@bindable onOk = null;
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
			}
		];
	}

	show (text, onOk) {
		this.text = text;
		this.isOpen = true;
		this.onOk = onOk;
	}
}
