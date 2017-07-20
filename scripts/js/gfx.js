var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var gfx;
(function (gfx) {
    var Component = (function () {
        function Component(x, y, width, height) {
            if (x === void 0) { x = 0; }
            if (y === void 0) { y = 0; }
            if (width === void 0) { width = 0; }
            if (height === void 0) { height = 0; }
            this.x = x;
            this.y = y;
            this.width = width;
            this.height = height;
        }
        Component.prototype.getParent = function () {
            return this.parent;
        };
        Component.prototype.setParent = function (p) {
            if (this.parent)
                this.parent.children.splice(this.parent.children.indexOf(this), 1);
            if (p === null)
                return;
            this.parent = p;
            this.parent.children.push(this);
        };
        Component.prototype.drawComponent = function (ctx) {
            ctx.translate(this.x, this.y);
        };
        Component.prototype.draw = function (ctx) {
            this.drawComponent(ctx);
        };
        Component.prototype.containsPoint = function (x, y) {
            return this.x < x && this.y < y && (this.x + this.width > x) && (this.y + this.height) > y;
        };
        return Component;
    }());
    var Container = (function (_super) {
        __extends(Container, _super);
        function Container() {
            return _super.call(this) || this;
        }
        Container.prototype.draw = function (ctx) {
            ctx.save();
            this.drawComponent(ctx);
            for (var i = 0; i < this.children.length; i++) {
                var c = this.children[i];
                ctx.save();
                c.draw(ctx);
                ctx.restore();
            }
            ctx.restore();
        };
        Container.prototype.componentAt = function (x, y, recur) {
            if (recur === void 0) { recur = true; }
            for (var i = 0; i < this.children.length; i++) {
                var c = this.children[i];
                if (c.containsPoint(x, y)) {
                    if (Container.isContainer(c) && recur) {
                        return c.componentAt(x - this.x, y - this.y);
                    }
                    else {
                        return c;
                    }
                }
            }
            return this;
        };
        Container.isContainer = function (c) {
            return c.children !== undefined;
        };
        return Container;
    }(Component));
})(gfx || (gfx = {}));
//# sourceMappingURL=gfx.js.map