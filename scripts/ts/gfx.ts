module gfx {
  class Component {
    public x: number;
    public y: number;

    public width: number;
    public height: number;

    private parent: Container;

    constructor(x: number = 0, y: number = 0, width: number = 0, height: number = 0) {
      this.x = x;
      this.y = y;
      this.width = width;
      this.height = height;
    }

    public getParent(): Container {
      return this.parent;
    }

    public setParent(p: Container): void {
      if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1);
      if (p === null) return;
      this.parent = p;
      this.parent.children.push(this);
    }

    public drawComponent(ctx: CanvasRenderingContext2D): void {
      ctx.translate(this.x, this.y);
    }

    public draw(ctx: CanvasRenderingContext2D): void {
      this.drawComponent(ctx);
    }
    
    public containsPoint(x: number, y: number): boolean {
      return this.x < x && this.y < y && (this.x + this.width > x) && (this.y + this.height) > y;
    }
    
  }

  class Container extends Component {
    public children: Component[];

    constructor() {
      super();
    }

    public draw(ctx: CanvasRenderingContext2D): void {
      ctx.save();
      this.drawComponent(ctx);
      for (let i = 0; i < this.children.length; i++) {
        let c = this.children[i];
        ctx.save();
        c.draw(ctx);
        ctx.restore();
      }
      ctx.restore();
    }

    public componentAt(x: number, y: number, recur: boolean = true): Component {
      for (let i = 0; i < this.children.length; i++) {
        let c = this.children[i];
        if (c.containsPoint(x, y)) {
          if (Container.isContainer(c) && recur) {
            return c.componentAt(x - this.x, y - this.y);
            
          } else {
            return c;
          }
        }
      }
      
      return this;
    }

    public static isContainer(c: Component): c is Container {
      return (<Container>c).children !== undefined;
    }
  }
}