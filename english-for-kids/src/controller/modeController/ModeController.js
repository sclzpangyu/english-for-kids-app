/* eslint-disable class-methods-use-this */
import eventMixin from '../../mixins/eventMixin';
import { playAsset } from '../../audio';

class ModeController {
	constructor(view, model) {
		this.view = view;
		this.model = model;
	}

	createCards() {
		this.view.cleanPage();
		this.view.drawCards(this.model.category.cards);
	}

	playWord(src) {
		playAsset(src);
	}

	destruct() {
		return true;
	}
}

Object.assign(ModeController.prototype, eventMixin);

export default ModeController;
