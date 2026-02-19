import React from 'react'
import { Link } from 'react-router-dom'
import logo from "../../images/logo.svg"
import search from "../../images/search.svg"
import profile from "../../images/profile.svg"
import shop from "../../images/shop.svg"
import "./Header.css"

function Header() {
    return (
        <>
            <header className='head'>
                <div className="container">
                    <div className="head__main">
                        <div className="head__top">
                            <Link className='head__logo' to={""}>
                                <img src={logo} alt="" />
                            </Link>

                            <div className="head-top__inner">
                                <button className='head-top__btns'><img src={search} alt="" /></button>
                                <button className='head-top__btns'><img src={profile} alt="" /></button>
                                <button className='head-top__btns'><img src={shop} alt="" /></button>
                            </div>
                        </div>
                        <div className="head__bottom">
                            <ul className="head__list">
                                <li className="head__item">
                                    <Link className='head__link'>каталог</Link>
                                </li>
                                <li className="head__item">
                                    <Link className='head__link'>бренды</Link>
                                </li>
                                <li className="head__item">
                                    <Link className='head__link'>акции</Link>
                                </li>

                                <li className="head__item">
                                    <Link className='head__link'>новинки</Link>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </header>
        </>
    )
}

export default Header